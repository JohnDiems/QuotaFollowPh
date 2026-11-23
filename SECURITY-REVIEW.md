# Local VAPT / source-assisted security review

Date: 2026-11-12. Target: QuoteFollow PH local source and an isolated production server at `127.0.0.1:3211`. Deployment remains paused.

This is a scoped automated and source-assisted assessment, not a certification or a complete external penetration test. No live customer records, credentials, email recipients, or payment accounts were modified. No messages, AI drafts, or payments were submitted.

## Findings and remediation

| Finding | Risk | Evidence | State |
| --- | --- | --- | --- |
| Workspace version check bypass with SQL NULL | Medium: own-workspace integrity and lost updates | Original `save_workspace` accepted `expected_version=null`; reproduced in embedded PostgreSQL. SQL comparisons with NULL skipped the stale-version rejection. | Fixed in migration 003; regression rejects null and stale versions. Live application pending. |
| Subscription gate could be bypassed through direct authenticated publish RPC | Medium: paid-feature access control | Original RPC allowed publishing with an expired subscription because only the Nuxt endpoint checked entitlement. Reproduced with an authenticated test role. | Migration 003 adds a protected database flag and RPC subscription check. Nuxt refuses to activate environment-only enforcement. Live application pending. |
| Chunked requests bypassed request-size enforcement | Medium: resource exhaustion | A chunked JSON request over 2 MB returned 400 after parsing rather than 413; middleware trusted Content-Length. | Fixed: actual byte-limited body readers, 15-second body timeout, object-only JSON input, and a 200 KB signed-webhook limit. Production probe returns 413. |
| Sensitive HTML lacked privacy and framing response headers | Medium: clickjacking and cache/referrer exposure defense | Original `/login` lacked Cache-Control, Referrer-Policy, and X-Frame-Options. APIs had partial coverage. | Headers now apply to HTML and API responses: private/no-store, no-referrer, DENY, nosniff, permissions policy, and CSP framing/base/object restrictions. HSTS is set for configured HTTPS origins. |
| NULL responder names accepted by direct response RPC | Low: audit-record integrity | SQL `length(trim(NULL))` did not trigger the rejection; app-only validation could be bypassed. | Migration 003 rejects null decision/name values; regression verifies rejection. Live application pending. |
| Nuxt 3 affected by published framework advisories | Moderate per upstream advisory; actual exploitability varies | Installed Nuxt 3.21.11 was identified by npm audit. | Upgraded to Nuxt 4.6.4 and matching Vue Router 5.4; preserved existing source layout with explicit srcDir. Typecheck and both Node and Vercel production builds passed. |
| Transitive dependency advisories remain | Low/moderate, open | See `security/dependency-audit.json`. Primarily deepmerge, glob, and minimatch through Nitro/build tooling. Dependency chains produce multiple package counts per advisory. | Open. No runtime exploitation demonstrated. Do not use forced audit fixes that downgrade patched Nuxt. Review upstream-compatible updates before a commercial launch. |

Nuxt's private runtime-config advisory affects development bundles, not normal production output. This project's private runtime config defaults were already empty with runtime `NUXT_*` values, an upstream-documented mitigation. No credential disclosure through that advisory was established here. The upgrade removes the affected framework version; it is not evidence that secrets had leaked.

Sources:
- https://github.com/nuxt/nuxt/security/advisories/GHSA-648h-gw55-m2g7
- https://nuxt.com/docs/4.x/getting-started/upgrade
- Individual dependency advisories and affected ranges are included in the saved npm audit JSON.

## Verified controls

- All 11 Node regression tests passed. TypeScript and both Node/Vercel builds passed. They cover centavo calculations, quote transitions, webhook signature/body/mode/timestamp checks, bounded input, and database security.
- PostgreSQL tests used disposable in-memory PGlite with emulated Supabase roles/auth.uid and the actual migration SQL. The pgcrypto extension statement was skipped because gen_random_uuid is built in. The original isolation SQL passed after the security migration: cross-owner isolation, sent-quote immutability, stale saves, revoked/unknown tokens, and duplicate customer decisions.
- The database test first reproduced the null-version and expired-subscription publishing behavior before applying migration 003, then verified both repairs. No live Supabase DDL or data was changed.
- 18 localhost production HTTP probes passed: anonymous workspace/billing denied, cross-site and missing-Origin writes rejected, mixed-case API cannot bypass origin protection, invalid tokens/private env files unavailable, HTML cache/framing/referrer protection, JSON validation, both declared and chunked body-size rejection, unsigned reminder jobs denied, unconfigured webhook disabled, and health endpoint available.
- Exact configured secret values were checked against 27 built public files plus homepage, marketing, login, and config responses. No secret matches were found. Actual values were never printed or stored in the report.
- User-supplied quote/customer text is rendered through Vue text interpolation; no v-html or direct HTML injection was found in the reviewed components.
- Customer links use 32 random bytes with SHA-256 hashes in storage. Public snapshots intentionally exclude customer email and phone. Anyone holding the private URL can respond; this is a documented capability link, not identity verification or a certified signature.

Reproduce local HTTP checks with `python3 scripts/vapt-http.py http://127.0.0.1:3211` against a running production build configured with that exact app origin. The script rejects non-localhost targets. Run `npm test`, `npm run typecheck`, and `npm run build` for the other checks.

## Required before deployment

1. Run `supabase/migrations/003_security_hardening.sql` in Supabase SQL Editor after 001 and 002. It adds security functions/settings without rewriting business records. Restart the development server after dependency/config changes. AI, email, and publishing now query the new billing flag, so the migration must precede use of the updated server.
2. Keep both `NUXT_BILLING_REQUIRED=false` and database `app_security_settings.billing_required=false` for the free pilot. After payment testing, paid publishing requires the database flag; when enabling it, configure the environment flag too. Only service-role/DB administration can change database enforcement. Do not enable live payments during VAPT.
3. Retest real Supabase authentication, email confirmation, password recovery, cookie attributes over HTTPS, and two-account isolation in staging. PGlite does not prove the hosted schema, grants, SMTP settings, RLS deployment, or provider configuration matches local source.
4. Confirm account secrets and deployment exclusions stay server-only. Do not expose the development server publicly. Configure edge/platform abuse controls before scaling; the current in-memory rate limiter is per instance and is not a global serverless quota.
5. Verify real PayMongo test-mode webhook schemas, retry/fulfillment behavior, and customer-email delivery with explicitly approved test records. The payment endpoint was tested only for signature logic and disabled/no-credentials behavior, not end-to-end payment fulfillment.
6. Resolve or formally assess remaining low/moderate transitive advisories. A full script-src nonce policy is not implemented: the CSP currently limits framing, base URLs, and object embedding. Browser interaction and mobile visual QA remain pending.
7. Gmail SMTP does not offer exactly-once delivery; repeated actions or job retries can duplicate email. The configured Resend path uses provider idempotency keys. Free-tier hosting and provider limitations are documented in DEPLOYMENT.md.

## Result

Application-level repairs and local regression verification are complete. Live database migration, staging/browser checks, provider end-to-end tests, distributed abuse controls, and remaining dependency advisories are outstanding. No claim of a vulnerability-free or production-certified system is made.
