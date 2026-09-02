import { createHash } from "crypto";

export type RateLimitResult = {
  allowed: boolean;
  limitType?: "RPM" | "RPD";
  retryAfterSeconds?: number;
  resetAt?: number;
  remainingRPM: number;
  remainingRPD: number;
};

export type RateLimitUsage = {
  rpmUsed: number;
  rpmLimit: number;
  rpdUsed: number;
  rpdLimit: number;
  rpmResetsAt: number | null;
  rpdResetsAt: number | null;
};

type Bucket = { minuteStartedAt: number; minuteCount: number; dayStartedAt: number; dayCount: number };
type LimitOptions = { rpm?: number; rpd?: number; scope?: string };

const buckets = new Map<string, Bucket>();
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRateLimitLimits(options: LimitOptions = {}): { rpmLimit: number; rpdLimit: number } {
  return {
    rpmLimit: options.rpm ?? positiveInteger(process.env.LLM_RPM_LIMIT, 20),
    rpdLimit: options.rpd ?? positiveInteger(process.env.LLM_RPD_LIMIT, 300),
  };
}

function opaqueKey(clientId: string, scope: string): string {
  return createHash("sha256").update(`${scope}:${clientId}`).digest("hex");
}

function localUsage(key: string, now: number, rpmLimit: number, rpdLimit: number, consume: boolean): RateLimitResult & RateLimitUsage {
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.dayStartedAt >= DAY_MS) {
    bucket = { minuteStartedAt: now, minuteCount: 0, dayStartedAt: now, dayCount: 0 };
  }
  if (now - bucket.minuteStartedAt >= MINUTE_MS) {
    bucket.minuteStartedAt = now;
    bucket.minuteCount = 0;
  }

  const blockedByMinute = bucket.minuteCount >= rpmLimit;
  const blockedByDay = bucket.dayCount >= rpdLimit;
  if (consume && !blockedByMinute && !blockedByDay) {
    bucket.minuteCount += 1;
    bucket.dayCount += 1;
  }
  buckets.set(key, bucket);

  const limitType = blockedByMinute ? "RPM" : blockedByDay ? "RPD" : undefined;
  const resetAt = limitType === "RPM" ? bucket.minuteStartedAt + MINUTE_MS : limitType === "RPD" ? bucket.dayStartedAt + DAY_MS : undefined;
  return {
    allowed: !limitType,
    limitType,
    retryAfterSeconds: resetAt ? Math.max(1, Math.ceil((resetAt - now) / 1000)) : undefined,
    resetAt,
    remainingRPM: Math.max(0, rpmLimit - bucket.minuteCount),
    remainingRPD: Math.max(0, rpdLimit - bucket.dayCount),
    rpmUsed: bucket.minuteCount,
    rpmLimit,
    rpdUsed: bucket.dayCount,
    rpdLimit,
    rpmResetsAt: bucket.minuteCount ? bucket.minuteStartedAt + MINUTE_MS : null,
    rpdResetsAt: bucket.dayCount ? bucket.dayStartedAt + DAY_MS : null,
  };
}

const DISTRIBUTED_SCRIPT = `
local minute = redis.call('INCR', KEYS[1])
if minute == 1 then redis.call('EXPIRE', KEYS[1], 60) end
local daily = redis.call('INCR', KEYS[2])
if daily == 1 then redis.call('EXPIRE', KEYS[2], 86400) end
return {minute, daily, redis.call('TTL', KEYS[1]), redis.call('TTL', KEYS[2])}
`;

async function distributedCounts(key: string): Promise<[number, number, number, number] | null> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", DISTRIBUTED_SCRIPT, "2", `campus-genie:minute:${key}`, `campus-genie:day:${key}`]),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Distributed rate-limit store returned ${response.status}`);
  const data = await response.json() as { result?: unknown[] };
  if (!Array.isArray(data.result) || data.result.length !== 4) throw new Error("Invalid distributed rate-limit response");
  return data.result.map(Number) as [number, number, number, number];
}

export async function checkRateLimit(clientId: string, options: LimitOptions = {}): Promise<RateLimitResult> {
  const { rpmLimit, rpdLimit } = getRateLimitLimits(options);
  const key = opaqueKey(clientId || "anonymous", options.scope || "default");
  try {
    const counts = await distributedCounts(key);
    if (counts) {
      const [minuteCount, dayCount, minuteTtl, dayTtl] = counts;
      const limitType = minuteCount > rpmLimit ? "RPM" : dayCount > rpdLimit ? "RPD" : undefined;
      const ttl = limitType === "RPM" ? minuteTtl : dayTtl;
      return {
        allowed: !limitType,
        limitType,
        retryAfterSeconds: limitType ? Math.max(1, ttl) : undefined,
        resetAt: limitType ? Date.now() + Math.max(1, ttl) * 1000 : undefined,
        remainingRPM: Math.max(0, rpmLimit - minuteCount),
        remainingRPD: Math.max(0, rpdLimit - dayCount),
      };
    }
  } catch (error) {
    console.error("[Rate limiter] Distributed store unavailable; using instance-local protection", error);
  }
  return localUsage(key, Date.now(), rpmLimit, rpdLimit, true);
}

export async function getRateLimitUsage(clientId: string, options: LimitOptions = {}): Promise<RateLimitUsage> {
  const { rpmLimit, rpdLimit } = getRateLimitLimits(options);
  const key = opaqueKey(clientId || "anonymous", options.scope || "default");
  const local = localUsage(key, Date.now(), rpmLimit, rpdLimit, false);
  return {
    rpmUsed: local.rpmUsed,
    rpmLimit,
    rpdUsed: local.rpdUsed,
    rpdLimit,
    rpmResetsAt: local.rpmResetsAt,
    rpdResetsAt: local.rpdResetsAt,
  };
}

/** Prefer an authenticated user id at call sites; this is the anonymous fallback. */
export function getClientIdFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "anonymous";
}
