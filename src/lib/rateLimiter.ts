export type RateLimitResult = {
  allowed: boolean;
  limitType?: "RPM" | "RPD";
  retryAfterSeconds?: number;
  resetAt?: number;
  remainingRPM?: number;
  remainingRPD?: number;
};

// In-memory sliding window bucket tracker
interface RateLimitBucket {
  timestamps: number[];
}

const clientBuckets = new Map<string, RateLimitBucket>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    for (const [key, bucket] of clientBuckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => ts > oneDayAgo);
      if (bucket.timestamps.length === 0) {
        clientBuckets.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export function checkRateLimit(
  clientId: string = "default_user",
  options?: {
    rpm?: number;
    rpd?: number;
  }
): RateLimitResult {
  const now = Date.now();
  const rpmLimit = options?.rpm || parseInt(process.env.LLM_RPM_LIMIT || "20", 10);
  const rpdLimit = options?.rpd || parseInt(process.env.LLM_RPD_LIMIT || "300", 10);

  let bucket = clientBuckets.get(clientId);
  if (!bucket) {
    bucket = { timestamps: [] };
    clientBuckets.set(clientId, bucket);
  }

  // Filter timestamps within the last 24 hours
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  bucket.timestamps = bucket.timestamps.filter((ts) => ts > oneDayAgo);

  const timestampsLastMinute = bucket.timestamps.filter((ts) => ts > oneMinuteAgo);
  const timestampsLastDay = bucket.timestamps;

  // Check RPM (Requests Per Minute)
  if (timestampsLastMinute.length >= rpmLimit) {
    const oldestInMinute = timestampsLastMinute[0];
    const retryAfterMs = Math.max(1000, 60 * 1000 - (now - oldestInMinute));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    const resetAt = now + retryAfterMs;

    return {
      allowed: false,
      limitType: "RPM",
      retryAfterSeconds,
      resetAt,
      remainingRPM: 0,
      remainingRPD: Math.max(0, rpdLimit - timestampsLastDay.length),
    };
  }

  // Check RPD (Requests Per Day)
  if (timestampsLastDay.length >= rpdLimit) {
    const oldestInDay = timestampsLastDay[0];
    const retryAfterMs = Math.max(1000, 24 * 60 * 60 * 1000 - (now - oldestInDay));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    const resetAt = now + retryAfterMs;

    return {
      allowed: false,
      limitType: "RPD",
      retryAfterSeconds,
      resetAt,
      remainingRPM: Math.max(0, rpmLimit - timestampsLastMinute.length),
      remainingRPD: 0,
    };
  }

  // Register request timestamp
  bucket.timestamps.push(now);

  return {
    allowed: true,
    remainingRPM: Math.max(0, rpmLimit - timestampsLastMinute.length - 1),
    remainingRPD: Math.max(0, rpdLimit - timestampsLastDay.length - 1),
  };
}

export function getRateLimitLimits(): { rpmLimit: number; rpdLimit: number } {
  return {
    rpmLimit: parseInt(process.env.LLM_RPM_LIMIT || "20", 10),
    rpdLimit: parseInt(process.env.LLM_RPD_LIMIT || "300", 10),
  };
}

export type RateLimitUsage = {
  rpmUsed: number;
  rpmLimit: number;
  rpdUsed: number;
  rpdLimit: number;
  /** Epoch ms when the per-minute window frees up (null if idle). */
  rpmResetsAt: number | null;
  /** Epoch ms when the daily window frees up (null if idle). */
  rpdResetsAt: number | null;
};

/**
 * Read-only view of a client's current quota consumption. Unlike
 * checkRateLimit, this does NOT register a request.
 */
export function getRateLimitUsage(clientId: string = "default_user"): RateLimitUsage {
  const { rpmLimit, rpdLimit } = getRateLimitLimits();
  const now = Date.now();
  const bucket = clientBuckets.get(clientId);
  const lastDay = bucket ? bucket.timestamps.filter((ts) => ts > now - 24 * 60 * 60 * 1000) : [];
  const lastMinute = lastDay.filter((ts) => ts > now - 60 * 1000);

  return {
    rpmUsed: lastMinute.length,
    rpmLimit,
    rpdUsed: lastDay.length,
    rpdLimit,
    rpmResetsAt: lastMinute.length > 0 ? lastMinute[0] + 60 * 1000 : null,
    rpdResetsAt: lastDay.length > 0 ? lastDay[0] + 24 * 60 * 60 * 1000 : null,
  };
}

/** Same client identity rule the chat route uses (proxy IP, then fallback). */
export function getClientIdFromHeaders(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    "client_user"
  );
}
