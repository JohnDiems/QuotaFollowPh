# Vercel deployment

Vercel supports this Nuxt app with server routes. The root `vercel.json` selects Nuxt; do not set a static output directory or use `nuxt generate`. Nitro automatically selects the Vercel preset on Vercel. Do not copy Render-specific `NITRO_PRESET=node-server` settings into Vercel.

Vercel Hobby is limited to personal, non-commercial projects. A commercial QuoteFollow PH service requires an eligible paid plan. Do not upgrade or enable paid billing under the free-only budget without a separate budget decision.

Connect Vercel or authenticate its CLI with `vercel login`. This project can be deployed directly with the CLI without a Git repository. `.vercelignore` excludes local environment files and build output from source uploads.

Set production environment variables privately in Vercel Project Settings:

- `NUXT_APP_URL`: exact stable HTTPS production origin, such as the assigned `https://YOUR-PROJECT.vercel.app` URL.
- `NUXT_SUPABASE_URL`, `NUXT_SUPABASE_ANON_KEY`, and server-only `NUXT_SUPABASE_SERVICE_KEY` (required for shared abuse protection).
- `NUXT_MAIL_PROVIDER=resend`, `NUXT_RESEND_API_KEY`, and `NUXT_MAIL_FROM`.
- `NUXT_BILLING_AMOUNT=49900` and `NUXT_BILLING_REQUIRED=false` until payments are verified.

Keep AI unset while it is skipped. PayMongo credentials remain optional; the Supabase server key is required for production request protection. Apply migrations 003 and 004 before using the updated server. Local `.env` values are not production settings. Use separate appropriate origins for Preview and Production: write requests enforce `NUXT_APP_URL` and an origin mismatch returns 403. Use the stable production domain for customer links, signup templates, and payment webhooks. Redeploy after changing environment settings.

Update Supabase Site URL to the stable production origin and apply the authentication templates below. Smoke-test `/api/health`, `/about`, signup, recovery, workspace saves, and private quote responses after deployment. Domain verification for customer email and payment account onboarding remain separate external steps.

The Render configuration below is retained as an alternative; it does not apply to Vercel.

---

# Free pilot deployment

Prepared for Render Free, with the existing Supabase project and Resend. This is a pilot configuration; provider accounts still need to be connected. Render's free web service sleeps after 15 minutes without incoming traffic, so first visits and webhook delivery can be delayed. No paid service or automatic renewal is configured.

## Deploy the source

This folder currently has no Git repository. Publish source to a private repository supported by Render, excluding `.env`, `node_modules`, `.nuxt`, and `.output` (already covered by `.gitignore`). Never upload credentials as source. Connect that repository to Render and use the root `render.yaml` Blueprint. The Blueprint requests a free Node service, not a static site, and uses `/api/health` for process health checks.

Enter these values privately in Render's environment settings:

- `NUXT_APP_URL`: the exact assigned HTTPS app origin, without a path or trailing slash.
- `NUXT_SUPABASE_URL` and `NUXT_SUPABASE_ANON_KEY`: from the existing project.
- `NUXT_SUPABASE_SERVICE_KEY`: server-only key required for production database-backed request quotas.
- `NUXT_RESEND_API_KEY`: the sending key.
- `NUXT_MAIL_FROM`: use the test sender initially; replace with an address on your verified domain for customer delivery.

The service starts using `npm start`. Keep billing enforcement false and AI credentials unset while testing free core features. Render's assigned subdomain provides an HTTPS URL without buying a domain. After the URL is assigned, update `NUXT_APP_URL` and redeploy before testing writes.

Run `npm run check:config` locally for a secret-free environment checklist. Set the production environment values directly on Render; the local `.env` is not uploaded automatically.

## Supabase authentication

In Authentication → URL Configuration, set Site URL to the deployed HTTPS app origin. Copy the contents of `supabase/templates/confirm-signup.html` into the Confirm signup email template, and `supabase/templates/reset-password.html` into Reset password. These use server-verified token hashes.

Configure production SMTP separately in Supabase Authentication. App-level `NUXT_RESEND_API_KEY` does not configure Supabase auth emails. Supabase's default email sender has delivery restrictions and is not intended for public production signup. Resend's shared test sender only sends to the Resend account email; a verified owned domain is required for real customer delivery. Do not turn off email confirmation as a substitute for configuring delivery.

## Business profile

Sign in to the workspace and enter the actual business name, public email, phone, address/service area, and quotation terms in Settings. Save and reload to verify persistence. No profile details are invented or copied from sample content. Published quotes keep their frozen business snapshot; fill the profile before creating new customer links.

## Resend domain

If an owned domain is available, add it in Resend and add the exact DNS records that Resend provides at the domain's DNS host. Wait for Verified, then set `NUXT_MAIL_FROM` to an address on that domain and redeploy. The domain and account DNS access cannot be derived from an API key. If you have no domain, keep testing to your own account email or copy messages manually; do not buy anything without a budget change.

## PayMongo test setup

Complete PayMongo account onboarding as required. Save `NUXT_PAYMONGO_SECRET_KEY=sk_test_...`, `NUXT_PAYMONGO_WEBHOOK_SECRET`, and `NUXT_SUPABASE_SERVICE_KEY` privately in the hosting environment. Never use the anon key as the service key.

Register a test-mode webhook at `https://YOUR-APP/api/billing/webhook` for `checkout_session.payment.paid`. Copy that endpoint's signing secret into the environment. Leave `NUXT_BILLING_AMOUNT=49900` (₱499) and `NUXT_BILLING_REQUIRED=false` during verification.

Use a separate test workspace. Test checkout, cancellation, signed paid events, retries, and invalid signatures. Confirm the database period extends only once on a valid paid event. A success redirect alone must not activate access. Apply migrations 003 and 004 before testing. To enable billing after successful verification, update `public.app_security_settings.billing_required` to true as well as `NUXT_BILLING_REQUIRED=true`. A database check enforces paid publishing even for direct authenticated RPC calls. Only after successful verification and an explicit commercial launch should live keys and billing enforcement be configured. Real payments have provider transaction fees; this free pilot does not enable them.

## Verification after deploy

1. Open `/about`, `/login`, and `/api/health` on the public URL.
2. Create a test account, receive its confirmation email, confirm, and sign in. Request recovery and successfully change its password. Verify logout and session refresh.
3. Save the actual business profile, a customer, and a sample quote; reload and confirm persistence.
4. Open a private quote link in another browser/device. Accept once and refresh the owner view. Test another quote's decline, expiry, and revocation.
5. Create a second account and check workspace isolation. Run `supabase/tests/isolation.sql` only in a disposable project as documented in SETUP.md.
6. Send one explicitly approved test email and check provider logs and the recipient inbox. An API acceptance response alone does not prove inbox delivery.
7. Check mobile layouts and printed PDFs.

These browser and external account checks remain pending until hosting and provider access are configured. Nuxt is upgraded to 4.6.4; patched transitive dependencies and the documented local deepmerge patch are recorded in SECURITY-REVIEW.md.

## Optional owner reminders

Set a strong `NUXT_CRON_SECRET`, the Supabase service key, and email delivery. Owners must opt in. A host/external scheduler must POST `/api/reminders` once daily with the bearer secret in the Authorization header. No paid Render cron resource is included in this free Blueprint. Do not put the secret in the URL or source. Migration 004 reserves each summary attempt before sending, so retries cannot submit the same owner/day again. Check provider logs on uncertain delivery before an operator clears a reservation. Resend also receives an idempotency key.
