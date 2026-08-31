"use client";

import { useMemo, useState } from "react";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-[8px] border border-line bg-canvas font-mono text-[12px] shadow-sm">
      <div className="flex items-center justify-between border-b border-line-soft bg-inset px-3 py-1.5 text-[11px] text-ink-3">
        <span>{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="hover:text-ink transition-colors cursor-pointer"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-ink leading-relaxed font-mono selection:bg-accent-tint">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function parseInline(text: string): React.ReactNode[] {
  // Simple, robust tokenizer for inline markdown elements:
  // bold/italic, inline code, links
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      elements.push(
        <code
          key={keyIdx++}
          className="rounded-[4px] border border-line-soft bg-field px-1.5 py-0.5 font-mono text-[11.5px] text-accent-ink"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 2. Bold + Italic: ***text***
    const boldItalicMatch = remaining.match(/^\*\*\*([^*]+)\*\*\*/);
    if (boldItalicMatch) {
      elements.push(<strong key={keyIdx++}><em>{boldItalicMatch[1]}</em></strong>);
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // 3. Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)([^*_]+)\1/);
    if (boldMatch) {
      elements.push(
        <strong key={keyIdx++} className="font-semibold text-ink">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 4. Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
    if (italicMatch) {
      elements.push(<em key={keyIdx++} className="italic text-ink-2">{italicMatch[2]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 5. Links: [label](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      elements.push(
        <a
          key={keyIdx++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-ink underline hover:text-ink transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 6. Plain text until next token
    const nextSpecial = remaining.search(/[`*_\[]/);
    if (nextSpecial === -1) {
      elements.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Stray token character
      elements.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      elements.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return elements;
}

export default function MarkdownMessage({ content }: { content: string }) {
  const blocks = useMemo(() => {
    if (!content) return [];

    const lines = content.split("\n");
    const parsedBlocks: React.ReactNode[] = [];
    let i = 0;
    let keyIdx = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code Block: ```lang
      if (line.trim().startsWith("```")) {
        const lang = line.trim().slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        parsedBlocks.push(
          <CodeBlock key={keyIdx++} language={lang} code={codeLines.join("\n")} />
        );
        continue;
      }

      // Empty line
      if (!line.trim()) {
        i++;
        continue;
      }

      // Heading 1: # Title
      if (line.startsWith("# ")) {
        parsedBlocks.push(
          <h1 key={keyIdx++} className="mt-4 mb-2 text-[18px] font-bold text-ink">
            {parseInline(line.slice(2))}
          </h1>
        );
        i++;
        continue;
      }

      // Heading 2: ## Title
      if (line.startsWith("## ")) {
        parsedBlocks.push(
          <h2 key={keyIdx++} className="mt-3 mb-1.5 text-[15.5px] font-semibold text-ink">
            {parseInline(line.slice(3))}
          </h2>
        );
        i++;
        continue;
      }

      // Heading 3: ### Title
      if (line.startsWith("### ")) {
        parsedBlocks.push(
          <h3 key={keyIdx++} className="mt-2.5 mb-1 text-[14px] font-semibold text-ink">
            {parseInline(line.slice(4))}
          </h3>
        );
        i++;
        continue;
      }

      // Blockquote: > text
      if (line.startsWith("> ")) {
        const quoteLines: string[] = [line.slice(2)];
        i++;
        while (i < lines.length && lines[i].startsWith("> ")) {
          quoteLines.push(lines[i].slice(2));
          i++;
        }
        parsedBlocks.push(
          <blockquote
            key={keyIdx++}
            className="my-2 border-l-2 border-accent pl-3 text-ink-2 italic"
          >
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx}>{parseInline(ql)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // Table: | col | col |
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        const tableLines: string[] = [line];
        i++;
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          const headerRow = tableLines[0].split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map((s) => s.trim());
          const bodyRows = tableLines.slice(2).map((row) =>
            row.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map((s) => s.trim())
          );
          parsedBlocks.push(
            <div key={keyIdx++} className="my-3 overflow-x-auto rounded-[8px] border border-line">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-inset border-b border-line text-ink font-semibold">
                  <tr>
                    {headerRow.map((h, hIdx) => (
                      <th key={hIdx} className="px-3 py-1.5">{parseInline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-hover/50">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-1.5 text-ink-2">{parseInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Unordered list: - item or * item
      if (line.match(/^(\s*)[-*]\s+/)) {
        const listItems: string[] = [];
        while (i < lines.length && lines[i].match(/^(\s*)[-*]\s+/)) {
          listItems.push(lines[i].replace(/^(\s*)[-*]\s+/, ""));
          i++;
        }
        parsedBlocks.push(
          <ul key={keyIdx++} className="my-2 list-disc pl-5 space-y-1 text-ink-2">
            {listItems.map((item, lIdx) => (
              <li key={lIdx} className="leading-relaxed">{parseInline(item)}</li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list: 1. item
      if (line.match(/^(\s*)\d+\.\s+/)) {
        const listItems: string[] = [];
        while (i < lines.length && lines[i].match(/^(\s*)\d+\.\s+/)) {
          listItems.push(lines[i].replace(/^(\s*)\d+\.\s+/, ""));
          i++;
        }
        parsedBlocks.push(
          <ol key={keyIdx++} className="my-2 list-decimal pl-5 space-y-1 text-ink-2">
            {listItems.map((item, lIdx) => (
              <li key={lIdx} className="leading-relaxed">{parseInline(item)}</li>
            ))}
          </ol>
        );
        continue;
      }

      // Horizontal Rule: ---
      if (line.trim() === "---" || line.trim() === "***") {
        parsedBlocks.push(<hr key={keyIdx++} className="my-3 border-line-soft" />);
        i++;
        continue;
      }

      // Paragraph: group contiguous regular lines
      const paraLines: string[] = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith("```") &&
        !lines[i].startsWith("#") &&
        !lines[i].startsWith(">") &&
        !lines[i].match(/^(\s*)[-*]\s+/) &&
        !lines[i].match(/^(\s*)\d+\.\s+/) &&
        !(lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) &&
        lines[i].trim() !== "---"
      ) {
        paraLines.push(lines[i]);
        i++;
      }

      parsedBlocks.push(
        <p key={keyIdx++} className="my-1.5 leading-relaxed text-ink">
          {paraLines.map((pl, plIdx) => (
            <span key={plIdx}>
              {parseInline(pl)}
              {plIdx < paraLines.length - 1 && <br />}
            </span>
          ))}
        </p>
      );
    }

    return parsedBlocks;
  }, [content]);

  return <div className="space-y-1 text-[13.5px] leading-relaxed select-text">{blocks}</div>;
}
