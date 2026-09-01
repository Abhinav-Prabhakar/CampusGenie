#!/usr/bin/env python3
"""Provision the Campus Opportunity Navigator schema through Databricks REST."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("DATABRICKS_HOST", "").rstrip("/")
TOKEN = os.environ.get("DATABRICKS_TOKEN", "")
WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")


def api(path: str, method: str = "GET", body: dict | None = None) -> dict:
    request = Request(
        f"{HOST}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=35) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Databricks returned HTTP {error.code}.") from None
    except URLError:
        raise RuntimeError("Databricks could not be reached.") from None


def execute(statement: str) -> None:
    result = api(
        "/api/2.0/sql/statements",
        "POST",
        {"warehouse_id": WAREHOUSE_ID, "statement": statement, "wait_timeout": "25s"},
    )
    statement_id = result.get("statement_id")
    if not statement_id:
        raise RuntimeError("Databricks did not return a statement ID.")
    for _ in range(40):
        state = result.get("status", {}).get("state")
        if state == "SUCCEEDED":
            return
        if state not in {"PENDING", "RUNNING"}:
            raise RuntimeError(f"SQL statement ended with state {state or 'UNKNOWN'}.")
        time.sleep(1)
        result = api(f"/api/2.0/sql/statements/{statement_id}")
    raise RuntimeError("SQL statement timed out.")


def statements(path: Path) -> list[str]:
    return [chunk.strip().rstrip(";") for chunk in path.read_text().split("-- COMMAND ----------") if chunk.strip()]


def main() -> int:
    missing = [name for name, value in {
        "DATABRICKS_HOST": HOST,
        "DATABRICKS_TOKEN": TOKEN,
        "DATABRICKS_WAREHOUSE_ID": WAREHOUSE_ID,
    }.items() if not value]
    if missing:
        print(f"Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        return 2
    if not HOST.startswith("https://"):
        print("DATABRICKS_HOST must use HTTPS.", file=sys.stderr)
        return 2

    sql = statements(ROOT / "sql" / "01_create_tables.sql") + statements(ROOT / "sql" / "02_seed_data.sql")
    for index, statement in enumerate(sql, start=1):
        print(f"Executing statement {index}/{len(sql)}")
        execute(statement)
    print("Campus Opportunity Navigator schema and synthetic snapshot are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
