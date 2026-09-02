import test from "node:test";
import assert from "node:assert/strict";
import {
  customEndpointsEnabled,
  isPublicIpAddress,
  validateCustomEndpointDestination,
  validateCustomEndpointUrl,
} from "../src/lib/llmEndpointSecurity.ts";

test("custom endpoints require an explicit non-production development flag", () => {
  assert.equal(customEndpointsEnabled({ NODE_ENV: "development", ALLOW_CUSTOM_LLM_ENDPOINTS: "true" }), true);
  assert.equal(customEndpointsEnabled({ NODE_ENV: "development", ALLOW_CUSTOM_LLM_ENDPOINTS: "false" }), false);
  assert.equal(customEndpointsEnabled({ NODE_ENV: "production", ALLOW_CUSTOM_LLM_ENDPOINTS: "true" }), false);
});

test("accepts a normal public HTTPS endpoint", () => {
  assert.deepEqual(validateCustomEndpointUrl("https://api.example.com/v1/"), {
    ok: true,
    url: "https://api.example.com/v1",
  });
});

test("rejects unsafe URL forms", () => {
  for (const value of [
    "http://api.example.com/v1",
    "https://user:password@api.example.com/v1",
    "https://api.example.com:8443/v1",
    "https://api.example.com/v1?target=internal",
    "https://api.example.com/v1#fragment",
    "https://localhost/v1",
    "https://model.internal/v1",
  ]) {
    assert.equal(validateCustomEndpointUrl(value).ok, false, `expected rejection for ${value}`);
  }
});

test("classifies private, loopback, link-local, and reserved addresses", () => {
  for (const address of [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.1.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ]) {
    assert.equal(isPublicIpAddress(address), false, `expected ${address} to be non-public`);
  }
  assert.equal(isPublicIpAddress("8.8.8.8"), true);
  assert.equal(isPublicIpAddress("2606:4700:4700::1111"), true);
});

test("rejects DNS names resolving to any private address", async () => {
  const result = await validateCustomEndpointDestination("https://api.example.com/v1", async () => [
    { address: "203.0.113.10", family: 4 },
    { address: "10.0.0.7", family: 4 },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.error, /private or reserved/);
});

test("accepts DNS names only when every resolved address is public", async () => {
  const result = await validateCustomEndpointDestination("https://api.example.com/v1", async () => [
    { address: "8.8.8.8", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 },
  ]);
  assert.deepEqual(result, { ok: true, url: "https://api.example.com/v1" });
});
