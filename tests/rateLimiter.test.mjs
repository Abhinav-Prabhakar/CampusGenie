import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, getRateLimitLimits, getRateLimitUsage } from "../src/lib/rateLimiter.ts";

test("allows requests up to the configured minute limit and then blocks", async () => {
  const client = `minute-${Date.now()}`;
  const options = { scope: "test", rpm: 2, rpd: 10 };

  assert.equal((await checkRateLimit(client, options)).allowed, true);
  assert.equal((await checkRateLimit(client, options)).allowed, true);
  const blocked = await checkRateLimit(client, options);

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.limitType, "RPM");
  assert.equal(blocked.remainingRPM, 0);
  assert.ok((blocked.retryAfterSeconds ?? 0) > 0);
});

test("separates quotas by caller and endpoint scope", async () => {
  const client = `scoped-${Date.now()}`;
  const options = { rpm: 1, rpd: 1 };

  assert.equal((await checkRateLimit(client, { ...options, scope: "chat" })).allowed, true);
  assert.equal((await checkRateLimit(client, { ...options, scope: "chat" })).allowed, false);
  assert.equal((await checkRateLimit(client, { ...options, scope: "recovery" })).allowed, true);
});

test("usage inspection does not consume local quota", async () => {
  const client = `usage-${Date.now()}`;
  const options = { scope: "test-usage", rpm: 3, rpd: 5 };
  const before = await getRateLimitUsage(client, options);
  const after = await getRateLimitUsage(client, options);

  assert.equal(before.rpmUsed, 0);
  assert.equal(after.rpdUsed, 0);
});

test("invalid environment limits fall back to safe defaults", () => {
  const previousRpm = process.env.LLM_RPM_LIMIT;
  const previousRpd = process.env.LLM_RPD_LIMIT;
  process.env.LLM_RPM_LIMIT = "0";
  process.env.LLM_RPD_LIMIT = "not-a-number";
  assert.deepEqual(getRateLimitLimits(), { rpmLimit: 20, rpdLimit: 300 });
  if (previousRpm === undefined) delete process.env.LLM_RPM_LIMIT;
  else process.env.LLM_RPM_LIMIT = previousRpm;
  if (previousRpd === undefined) delete process.env.LLM_RPD_LIMIT;
  else process.env.LLM_RPD_LIMIT = previousRpd;
});
