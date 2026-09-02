const CAMPUS_CATALOG = "workspace";
const CAMPUS_SCHEMA = "campus_explorer";

export const CHAT_ANALYTICS_TABLES = [
  "campus_events",
  "campus_surveys",
  "knowledge_sources",
  "campus_locations",
  "clubs_and_labs",
  "city_tech_events",
  "alumni_career_pathways",
  "procurement_inventory",
] as const;

const allowedTables = new Set<string>(CHAT_ANALYTICS_TABLES);

const forbiddenKeywords = new Set([
  "add",
  "alter",
  "analyze",
  "cache",
  "call",
  "copy",
  "create",
  "delete",
  "describe",
  "drop",
  "execute",
  "export",
  "grant",
  "import",
  "insert",
  "load",
  "merge",
  "msck",
  "optimize",
  "put",
  "refresh",
  "remove",
  "recursive",
  "replace",
  "restore",
  "revoke",
  "set",
  "show",
  "truncate",
  "uncache",
  "update",
  "use",
  "vacuum",
]);

const fromClauseTerminators = new Set([
  "where",
  "group",
  "order",
  "having",
  "limit",
  "qualify",
  "window",
  "union",
  "intersect",
  "except",
  "cluster",
  "distribute",
  "sort",
]);

type Token = {
  kind: "word" | "quotedIdentifier" | "string" | "number" | "symbol";
  value: string;
  lower: string;
  start: number;
  end: number;
  depth: number;
};

export type CampusSqlValidation =
  | { ok: true; sql: string; tables: string[] }
  | { ok: false; error: string };

function tokenize(sql: string): { tokens?: Token[]; error?: string } {
  const tokens: Token[] = [];
  let depth = 0;
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (sql.startsWith("--", index) || sql.startsWith("/*", index) || char === "#") {
      return { error: "SQL comments are not permitted" };
    }

    if (char === "'" || char === '"') {
      const quote = char;
      const start = index++;
      let closed = false;
      while (index < sql.length) {
        if (sql[index] === "\\") {
          index += 2;
          continue;
        }
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            index += 2;
            continue;
          }
          index++;
          closed = true;
          break;
        }
        index++;
      }
      if (!closed) return { error: "SQL contains an unterminated string" };
      tokens.push({ kind: "string", value: sql.slice(start, index), lower: "", start, end: index, depth });
      continue;
    }

    if (char === "`") {
      const start = index++;
      let value = "";
      let closed = false;
      while (index < sql.length) {
        if (sql[index] === "`") {
          if (sql[index + 1] === "`") {
            value += "`";
            index += 2;
            continue;
          }
          index++;
          closed = true;
          break;
        }
        value += sql[index++];
      }
      if (!closed || !value) return { error: "SQL contains an invalid quoted identifier" };
      tokens.push({ kind: "quotedIdentifier", value, lower: value.toLowerCase(), start, end: index, depth });
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      const start = index++;
      while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index])) index++;
      const value = sql.slice(start, index);
      tokens.push({ kind: "word", value, lower: value.toLowerCase(), start, end: index, depth });
      continue;
    }

    if (/[0-9]/.test(char)) {
      const start = index++;
      while (index < sql.length && /[0-9.eE+-]/.test(sql[index])) index++;
      const value = sql.slice(start, index);
      tokens.push({ kind: "number", value, lower: value.toLowerCase(), start, end: index, depth });
      continue;
    }

    if (char === "(") {
      tokens.push({ kind: "symbol", value: char, lower: char, start: index, end: index + 1, depth });
      depth++;
      index++;
      continue;
    }
    if (char === ")") {
      depth--;
      if (depth < 0) return { error: "SQL contains unbalanced parentheses" };
      tokens.push({ kind: "symbol", value: char, lower: char, start: index, end: index + 1, depth });
      index++;
      continue;
    }

    tokens.push({ kind: "symbol", value: char, lower: char, start: index, end: index + 1, depth });
    index++;
  }

  if (depth !== 0) return { error: "SQL contains unbalanced parentheses" };
  return { tokens };
}

function isIdentifier(token: Token | undefined): token is Token {
  return token?.kind === "word" || token?.kind === "quotedIdentifier";
}

/**
 * Validate and normalize SQL authored by the chat model before it reaches the
 * Databricks Statement API. The accepted language is intentionally narrow:
 * one SELECT/WITH query over public Campus Genie analytical tables.
 */
export function validateCampusReadOnlySql(input: unknown): CampusSqlValidation {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "No SQL statement provided" };
  }

  let sql = input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim();
  if (sql.length > 12_000) return { ok: false, error: "SQL statement is too long" };
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trimEnd();

  const scanned = tokenize(sql);
  if (!scanned.tokens) return { ok: false, error: scanned.error || "Invalid SQL" };
  const tokens = scanned.tokens;
  if (tokens.length === 0) return { ok: false, error: "No SQL statement provided" };
  if (tokens.some((token) => token.kind === "symbol" && token.value === ";")) {
    return { ok: false, error: "Only one SQL statement is permitted" };
  }

  const first = tokens[0];
  if (first.kind !== "word" || (first.lower !== "select" && first.lower !== "with")) {
    return { ok: false, error: "SQL must begin with SELECT or WITH" };
  }
  const forbidden = tokens.find((token) => token.kind === "word" && forbiddenKeywords.has(token.lower));
  if (forbidden) return { ok: false, error: `SQL keyword ${forbidden.value.toUpperCase()} is not permitted` };

  const ctes: Array<{ name: string; availableAfter: number; scopeDepth: number; scopeEnd: number }> = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== "word" || tokens[i].lower !== "with") continue;
    const scopeDepth = tokens[i].depth;
    const scopeEnd = tokens.findIndex(
      (token, tokenIndex) => tokenIndex > i && token.value === ")" && token.depth < scopeDepth,
    );
    let cursor = i + 1;
    while (cursor + 2 < tokens.length) {
      const name = tokens[cursor];
      const asToken = tokens[cursor + 1];
      const open = tokens[cursor + 2];
      if (!isIdentifier(name) || asToken?.lower !== "as" || open?.value !== "(" || open.depth !== scopeDepth) break;
      const closeIndex = tokens.findIndex(
        (token, tokenIndex) => tokenIndex > cursor + 2 && token.value === ")" && token.depth === scopeDepth,
      );
      if (closeIndex === -1) return { ok: false, error: "CTE contains unbalanced parentheses" };
      ctes.push({
        name: name.lower,
        availableAfter: closeIndex,
        scopeDepth,
        scopeEnd: scopeEnd === -1 ? tokens.length : scopeEnd,
      });
      if (tokens[closeIndex + 1]?.value !== "," || tokens[closeIndex + 1]?.depth !== scopeDepth) break;
      cursor = closeIndex + 2;
    }
  }

  const activeFromDepths = new Set<number>();
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  const referencedTables = new Set<string>();

  const validateRelation = (startIndex: number): { nextIndex: number; error?: string } => {
    const relation = tokens[startIndex];
    if (!relation) return { nextIndex: startIndex, error: "Missing table after FROM or JOIN" };
    if (relation.value === "(") {
      const firstInside = tokens[startIndex + 1];
      if (!firstInside || firstInside.kind !== "word" || !["select", "with"].includes(firstInside.lower)) {
        return { nextIndex: startIndex, error: "FROM subqueries must begin with SELECT or WITH" };
      }
      return { nextIndex: startIndex };
    }
    if (!isIdentifier(relation)) {
      return { nextIndex: startIndex, error: "Invalid table reference" };
    }

    const parts = [relation.lower];
    let endIndex = startIndex;
    while (tokens[endIndex + 1]?.value === "." && isIdentifier(tokens[endIndex + 2])) {
      parts.push(tokens[endIndex + 2].lower);
      endIndex += 2;
    }
    if (tokens[endIndex + 1]?.value === "(") {
      return { nextIndex: endIndex, error: "Table-valued functions are not permitted" };
    }

    const isVisibleCte =
      parts.length === 1 &&
      ctes.some(
        (cte) =>
          cte.name === parts[0] &&
          startIndex > cte.availableAfter &&
          startIndex < cte.scopeEnd &&
          relation.depth >= cte.scopeDepth,
      );
    if (isVisibleCte) return { nextIndex: endIndex };

    const table = parts.at(-1)!;
    const approvedUnqualified = parts.length === 1 && allowedTables.has(table);
    const approvedQualified =
      parts.length === 3 &&
      parts[0] === CAMPUS_CATALOG &&
      parts[1] === CAMPUS_SCHEMA &&
      allowedTables.has(table);
    if (!approvedUnqualified && !approvedQualified) {
      return {
        nextIndex: endIndex,
        error: `Table ${parts.join(".")} is not available to chat queries`,
      };
    }

    referencedTables.add(table);
    if (approvedUnqualified) {
      replacements.push({
        start: relation.start,
        end: relation.end,
        value: `${CAMPUS_CATALOG}.${CAMPUS_SCHEMA}.${table}`,
      });
    }
    return { nextIndex: endIndex };
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.value === ")") {
      for (const depth of activeFromDepths) {
        if (depth > token.depth) activeFromDepths.delete(depth);
      }
    }
    if (token.kind === "word" && fromClauseTerminators.has(token.lower)) {
      activeFromDepths.delete(token.depth);
      continue;
    }
    if (token.kind === "word" && token.lower === "from") {
      activeFromDepths.add(token.depth);
      const result = validateRelation(i + 1);
      if (result.error) return { ok: false, error: result.error };
      i = result.nextIndex;
      continue;
    }
    if (token.kind === "word" && token.lower === "join") {
      const result = validateRelation(i + 1);
      if (result.error) return { ok: false, error: result.error };
      i = result.nextIndex;
      continue;
    }
    if (token.value === "," && activeFromDepths.has(token.depth)) {
      const result = validateRelation(i + 1);
      if (result.error) return { ok: false, error: result.error };
      i = result.nextIndex;
    }
  }

  if (referencedTables.size === 0) {
    return { ok: false, error: "Query must read from an approved Campus Genie table" };
  }

  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    sql = `${sql.slice(0, replacement.start)}${replacement.value}${sql.slice(replacement.end)}`;
  }
  return { ok: true, sql, tables: [...referencedTables] };
}
