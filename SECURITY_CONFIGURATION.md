# Production security configuration

Campus Genie enforces per-caller limits on chat, mobile Genie, and AI attendance recovery requests. Local development uses an in-process limiter. For consistent enforcement across Vercel serverless instances, connect a Redis integration from the Vercel Marketplace and expose either of these environment-variable pairs:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

Chat defaults to 20 requests per minute and 300 requests per day. Override those values with positive integers in `LLM_RPM_LIMIT` and `LLM_RPD_LIMIT`. Mobile Genie is limited to 10 requests per minute and 100 per day; attendance recovery is limited to 5 per minute and 50 per day.

The application sends baseline browser security headers globally from `next.config.ts`, including HSTS, clickjacking protection, MIME sniffing protection, a permissions policy, and a Content Security Policy compatible with Clerk.
