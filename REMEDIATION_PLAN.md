# Campus Genie remediation plan

Audit date: 2026-09-02

This plan is intentionally sequential. Complete and verify one item before starting the next.

## Confirmed progress since the earlier review

- Raw `/api/lakehouse` execution now requires an authenticated app admin.
- Awards, teammate matching, complaints, alumni browsing, and alumni intro requests now have routes and UI.
- The test suite has real campus-direction tests, although the security suite claimed by the README is still absent.

## Ordered fix queue

1. **Self-service admin escalation — fixed locally**
   - `/api/users` rejects every caller-supplied `role` field with HTTP 403.
   - The profile no longer offers a role toggle.
   - Regression tests cover attempted promotion and valid self-profile updates.

2. **Chat SQL security boundary — next**
   - Replace the destructive-keyword blocklist with a single-statement read-only allowlist.
   - Allow only approved analytical tables and columns.
   - Keep private tables such as `app_users`, `chat_threads`, attendance, complaints, and intro requests unavailable to model-authored SQL.
   - Add deterministic tests for DDL/DML, multi-statement, cross-schema, comment, and obfuscation cases.

3. **Custom LLM endpoint SSRF and server-key exfiltration**
   - Never combine a caller-supplied base URL with a server-owned API key.
   - Restrict or remove arbitrary custom endpoints in production.
   - Reject loopback, link-local, private-network, and non-HTTPS destinations.

4. **Production Clerk configuration**
   - Replace the deployed `pk_test_…`/development Clerk instance with production keys and domain configuration.
   - Verify signed-out navigation, sign-in, sign-up, session refresh, and admin access on Vercel.
   - This requires deployment-environment changes, not only repository code.

5. **Mobile API authentication contract**
   - `/api/mobile` currently resolves to a Clerk-protected 404 in production.
   - Choose an explicit mobile session/token flow; do not simply make the Genie endpoint public.
   - Add CORS and authenticated device tests after the contract is chosen.

6. **Parameterized Databricks SQL**
   - Add Statement API parameter support in the shared Lakehouse client.
   - Migrate user, thread, attendance, event, source, teammate, complaint, and alumni-intro queries away from interpolation.

7. **Security headers and durable rate limiting**
   - Add CSP, frame protection, `nosniff`, and a referrer policy.
   - Replace per-instance IP memory counters with a shared limiter keyed primarily by authenticated user.

8. **Genie conversation continuity**
   - Persist `conversation_id` per chat thread.
   - Continue with `/conversations/{id}/messages` for follow-ups and recover cleanly when a conversation expires.

9. **Genie routing and response richness**
   - Remove the paid LLM classifier gate or replace it with deterministic routing plus a Genie-first fallback.
   - Surface `suggested_questions` as follow-up chips.
   - Enable and render non-event tabular/visual results instead of flattening them to prose.

10. **Truthful documentation and meaningful security tests**
    - Remove README claims that are not implemented, or implement them before restoring the claims.
    - Replace the Lakehouse diagram placeholder with the real checked-in diagram.
    - Keep the README table list synchronized with the actual schema.

11. **Student-facing UX cleanup**
    - Remove broad `select-none` from page shells so chat answers can be copied.
    - Rename raw SQL reasoning to a collapsed “How Genie found this” detail.
    - Hide provider/custom-endpoint plumbing behind an explicit development/admin flag.

12. **Data and tenancy correctness**
    - Add college/tenant keys to shared campus datasets and scope every query.
    - Normalize `user_id`/`student_id`, remove the null-capacity fallback, and replace the hard-coded “today” day value.
    - Reconcile `backend/init_lakehouse.py` with the canonical SQL schema and seed dates.

13. **Transactional and real-time architecture**
    - Move users, chat-thread state, device tokens, presence, help requests, and similar OLTP data to Lakebase.
    - Add help-request lifecycle, nearby-helper matching, FCM push, occupancy/prediction streams, and lost items as separately testable vertical slices.
    - Keep analytical campus datasets in Delta and define the Lakeflow synchronization boundary.

14. **Performance and maintainability**
    - Cache stable campus context and remove redundant warehouse round-trips.
    - Move PDF/OCR ingestion out of Vercel request functions.
    - Split the oversized client pages/admin component and consolidate duplicated web/mobile/Databricks logic.

## Verification gate for every item

- Add focused regression tests first or alongside the fix.
- Run `npm test`, `npm run lint`, and `npm run build`.
- For UI/API behavior, verify the deployed path after deployment, including failure and unauthorized states.
- Do not advance to the next numbered item while the current item has unresolved failures.
