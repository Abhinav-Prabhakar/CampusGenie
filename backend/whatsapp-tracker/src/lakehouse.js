import { CONFIG, resolveDatabricksToken } from "./config.js";

/**
 * Execute a SQL query via Databricks Statement Execution REST API
 */
export async function executeDatabricksSql(statement, parameters = []) {
  const token = await resolveDatabricksToken();
  if (!CONFIG.databricksHost || !token) {
    throw new Error("Missing DATABRICKS_HOST or DATABRICKS_TOKEN (no active CLI OAuth session).");
  }

  const url = `${CONFIG.databricksHost}/api/2.0/sql/statements`;
  const body = {
    warehouse_id: CONFIG.databricksWarehouseId,
    statement,
    wait_timeout: "45s",
    on_wait_timeout: "CONTINUE",
  };

  if (parameters && parameters.length > 0) {
    body.parameters = parameters.map((p, idx) => ({
      name: p.name || `param_${idx}`,
      value: p.value !== undefined ? String(p.value) : "",
      type: p.type || "STRING",
    }));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Databricks SQL API error (${res.status}): ${errText}`);
  }

  let result = await res.json();
  const statementId = result.statement_id;

  // Poll if still executing
  const startTime = Date.now();
  while (result.status?.state === "PENDING" || result.status?.state === "RUNNING") {
    if (Date.now() - startTime > 60000) {
      throw new Error("Databricks SQL statement timed out after 60s");
    }
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${CONFIG.databricksHost}/api/2.0/sql/statements/${statementId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    result = await pollRes.json();
  }

  if (result.status?.state === "FAILED") {
    throw new Error(`Databricks SQL execution failed: ${result.status?.error?.message || "Unknown error"}`);
  }

  const columns = result.manifest?.schema?.columns?.map((c) => c.name) || [];
  const dataArray = result.result?.data_array || [];

  return dataArray.map((row) => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

/**
 * Check whether an event with a similar title and date already exists
 */
export async function checkEventExists(title, eventDate) {
  try {
    const safeTitle = (title || "").trim().replace(/'/g, "''");
    const sql = `
      SELECT event_id, title, event_date
      FROM workspace.campus_explorer.campus_events
      WHERE lower(trim(title)) = lower('${safeTitle}')
         OR (event_date = '${eventDate}' AND lower(title) LIKE '%${safeTitle.slice(0, 15).toLowerCase()}%')
      LIMIT 1
    `;
    const rows = await executeDatabricksSql(sql);
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.warn("[Lakehouse] Duplicate check failed (proceeding):", err.message);
    return null;
  }
}

/**
 * Insert an extracted event into workspace.campus_explorer.campus_events
 */
export async function insertCampusEvent(event) {
  const eventId = `EV-WA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Sanitize fields
  const title = (event.title || "Untitled Campus Event").replace(/'/g, "''");
  const category = (event.category || "social").toLowerCase().replace(/'/g, "''");
  const hostOrg = (event.hostOrganization || "Campus Community").replace(/'/g, "''");
  const location = (event.location || "Campus Center").replace(/'/g, "''");
  const isVirtual = Boolean(event.isVirtual);
  const eventDate = event.eventDate || new Date().toISOString().slice(0, 10);
  const startTime = (event.startTime || "05:00 PM").replace(/'/g, "''");
  const duration = (event.duration || "2h").replace(/'/g, "''");
  const capacity = Number(event.capacity) || 120;
  const foodProvided = Boolean(event.foodProvided);
  const tagsList = Array.isArray(event.tags) && event.tags.length > 0
    ? `array(${event.tags.map((t) => `'${String(t).replace(/'/g, "''")}'`).join(", ")})`
    : `array('WhatsApp', 'Campus')`;
  const description = (event.description || "").replace(/'/g, "''");
  const whatsappUrl = (event.whatsappUrl || "").replace(/'/g, "''");

  const sql = `
    INSERT INTO workspace.campus_explorer.campus_events (
      event_id,
      title,
      category,
      host_organization,
      host_code,
      location,
      is_virtual,
      event_date,
      start_time,
      duration,
      capacity,
      registered_count,
      food_provided,
      is_featured,
      status,
      visibility,
      tags,
      description,
      created_at,
      created_by,
      whatsapp_url
    ) VALUES (
      '${eventId}',
      '${title}',
      '${category}',
      '${hostOrg}',
      'WA',
      '${location}',
      ${isVirtual},
      DATE '${eventDate}',
      '${startTime}',
      '${duration}',
      ${capacity},
      0,
      ${foodProvided},
      false,
      'live',
      'public',
      ${tagsList},
      '${description}',
      current_timestamp(),
      'whatsapp_tracker',
      '${whatsappUrl}'
    )
  `;

  await executeDatabricksSql(sql);

  return {
    eventId,
    title,
    eventDate,
    category,
    location,
  };
}
