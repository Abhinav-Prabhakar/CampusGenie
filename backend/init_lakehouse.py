#!/usr/bin/env python3
"""
Campus Genie — Databricks Lakehouse Initialization & Seed Script
Executes DDL and DML to provision Unity Catalog Delta tables for Campus Genie.
"""

import json
import os
import subprocess
import sys
import time

WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "25132a20d91813ef")
SQL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sql")


def load_statements():
  """DDL and seed statements live in backend/sql/*.sql (single source of truth)."""
  statements = []
  for filename in sorted(os.listdir(SQL_DIR)):
    if not filename.endswith(".sql"):
      continue
    with open(os.path.join(SQL_DIR, filename), "r", encoding="utf-8") as fh:
      content = fh.read()
    for stmt in content.split(";"):
      stmt = stmt.strip()
      if stmt:
        statements.append((filename, stmt))
  return statements


STATEMENTS = [stmt for _, stmt in load_statements()]


def execute_sql(stmt: str):
    print(f"\n[Executing SQL]: {stmt.strip()[:90]}...")
    payload = {
        "warehouse_id": WAREHOUSE_ID,
        "statement": stmt,
        "wait_timeout": "30s"
    }
    cmd = [
        "databricks", "api", "post", "/api/2.0/sql/statements",
        "--json", json.dumps(payload)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error executing statement: {res.stderr}")
        return False
    data = json.loads(res.stdout)
    stmt_id = data.get("statement_id")
    state = data.get("status", {}).get("state")
    
    while state in ("PENDING", "RUNNING"):
        time.sleep(2)
        check_cmd = ["databricks", "api", "get", f"/api/2.0/sql/statements/{stmt_id}"]
        check_res = subprocess.run(check_cmd, capture_output=True, text=True)
        if check_res.returncode == 0:
            check_data = json.loads(check_res.stdout)
            state = check_data.get("status", {}).get("state")
            if state == "SUCCEEDED":
                print(f"✓ Statement {stmt_id} succeeded.")
                return True
            elif state in ("FAILED", "CANCELED", "CLOSED"):
                print(f"✗ Statement {stmt_id} {state}: {check_data.get('status', {}).get('error')}")
                return False
    
    if state == "SUCCEEDED":
        print(f"✓ Statement {stmt_id} succeeded.")
        return True
    else:
        print(f"✗ Statement {stmt_id} {state}")
        return False

def main():
    print(f"=== Initializing Campus Genie Lakehouse on Warehouse {WAREHOUSE_ID} ===")
    success_count = 0
    for idx, stmt in enumerate(STATEMENTS, 1):
        print(f"\n--- Step {idx}/{len(STATEMENTS)} ---")
        if execute_sql(stmt):
            success_count += 1
        else:
            print(f"Warning: Step {idx} did not succeed.")
    
    print(f"\n==========================================")
    print(f"Completed Lakehouse Init: {success_count}/{len(STATEMENTS)} succeeded.")
    print(f"Unity Catalog Schema: workspace.campus_explorer")
    print(f"==========================================")

if __name__ == "__main__":
    main()
