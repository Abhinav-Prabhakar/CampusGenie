import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type ResolvedAddress = { address: string; family?: number };
type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export type EndpointValidation =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function customEndpointsEnabled(environment: Record<string, string | undefined>): boolean {
  return environment.NODE_ENV !== "production" && environment.ALLOW_CUSTOM_LLM_ENDPOINTS === "true";
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0) return false;
  return true;
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family !== 6) return false;

  if (normalized.startsWith("::ffff:")) {
    return isPublicIpv4(normalized.slice("::ffff:".length));
  }
  if (normalized === "::" || normalized === "::1") return false;
  if (/^f[cd]/.test(normalized)) return false;
  if (/^fe[89ab]/.test(normalized)) return false;
  if (normalized.startsWith("ff") || normalized.startsWith("2001:db8")) return false;
  return true;
}

export function validateCustomEndpointUrl(rawUrl: unknown): EndpointValidation {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { ok: false, error: "A custom endpoint URL is required" };
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "Custom endpoint URL is invalid" };
  }

  if (url.protocol !== "https:") return { ok: false, error: "Custom endpoints must use HTTPS" };
  if (url.username || url.password) return { ok: false, error: "Custom endpoints cannot include URL credentials" };
  if (url.port && url.port !== "443") return { ok: false, error: "Custom endpoints must use the standard HTTPS port" };
  if (url.search || url.hash) return { ok: false, error: "Custom endpoints cannot include a query string or fragment" };

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa") ||
    hostname === "metadata.google.internal"
  ) {
    return { ok: false, error: "Custom endpoint host is not permitted" };
  }
  if (isIP(hostname) && !isPublicIpAddress(hostname)) {
    return { ok: false, error: "Custom endpoint must not target a private or reserved network" };
  }

  return { ok: true, url: url.toString().replace(/\/$/, "") };
}

async function resolveWithDns(hostname: string): Promise<ResolvedAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

export async function validateCustomEndpointDestination(
  rawUrl: unknown,
  resolver: HostResolver = resolveWithDns,
): Promise<EndpointValidation> {
  const parsed = validateCustomEndpointUrl(rawUrl);
  if (!parsed.ok) return parsed;

  const hostname = new URL(parsed.url).hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return parsed;

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(hostname);
  } catch {
    return { ok: false, error: "Custom endpoint host could not be resolved" };
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    return { ok: false, error: "Custom endpoint resolves to a private or reserved network" };
  }
  return parsed;
}
