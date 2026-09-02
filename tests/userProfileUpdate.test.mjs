import test from "node:test";
import assert from "node:assert/strict";
import { parseSelfProfileUpdate } from "../src/lib/userProfileUpdate.ts";

test("self-profile updates reject role changes", () => {
  assert.deepEqual(parseSelfProfileUpdate({ role: "admin" }), {
    ok: false,
    status: 403,
    error: "Role changes must be performed by a campus administrator",
  });
});

test("self-profile updates accept supported fields and normalize values", () => {
  assert.deepEqual(
    parseSelfProfileUpdate({ college: "  Databricks University  ", phoneNumber: "  +91 555 0100  " }),
    {
      ok: true,
      update: {
        college: "Databricks University",
        phoneNumber: "+91 555 0100",
      },
    },
  );
});

test("self-profile updates can clear a phone number", () => {
  assert.deepEqual(parseSelfProfileUpdate({ phoneNumber: null }), {
    ok: true,
    update: { phoneNumber: null },
  });
});
