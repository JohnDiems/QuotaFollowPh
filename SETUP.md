# Enable cloud accounts and integrations

This app requires Supabase accounts and cloud storage. There is no local demo or browser-storage fallback. External accounts have not been configured or tested live from this workspace.

## Supabase

Create a project. In its SQL Editor run, in order:

1. `supabase/migrations/001_workspace.sql`
2. `supabase/migrations/002_billing_and_reminders.sql`
3. `supabase/migrations/003_security_hardening.sql`
4. `supabase/migrations/004_abuse_and_delivery_guards.sql`

Copy `.env.example` to `.env`. Set `NUXT_APP_URL` to the exact app origin (initially `http://localhost:3000`), `NUXT_SUPABASE_URL`, and `NUXT_SUPABASE_ANON_KEY`. Set the server-only `NUXT_SUPABASE_SERVICE_KEY` for production shared request limits, billing fulfillment, and scheduled reminders. Production auth and guarded operations fail closed without this key and migration 004. Development without the key uses a bounded per-process backstop. Normal workspace requests use the owner's verified token and RLS, never the service-role key. All keys stay on the server.

In Supabase Authentication, set the Site URL to your app URL and enable email confirmation. Configure production SMTP and abuse protection before opening signup publicly. Customize the email templates:

Confirm signup:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}">Confirm email</a>
```

Reset password:

```html
<a href="{{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}">Reset password</a>
```

The app verifies tokens server-side and keeps sessions in HttpOnly cookies. Signup and reset require 12-character passwords. Set an HTTPS app origin in production to enable secure cookies.

Restart Nuxt, visit `/login`, create an account, confirm your email, and sign in. Fill out Settings, add services, and add your first customer. New business accounts start empty.

Cloud changes autosave after a short delay. **Save now** waits for pending changes. Conflicts with another tab or a customer decision are rejected instead of overwritten. If this happens, export a backup before reloading and reapply your unsaved edits. Use **Refresh responses** after your edits have saved.

## Customer links

Create a quote, open its preview, then select **Create customer link**. Publication marks it sent, freezes a snapshot, and revokes previous links for that quote. Copy the URL before closing; the database stores only its SHA-256 hash. Generate a new link if you lose it.

Customers view, print, accept, or decline without accounts. Their name, decision, and timestamp are recorded. Anyone holding the private URL can respond: there is no recipient identity verification or certified digital signature. Expired, revoked, and completed links reject new decisions.

Use **Create revision** to make an editable draft from a sent quote. Revoke the earlier quote's links explicitly if the revision supersedes it.

## AI (optional)

Set `NUXT_OPENAI_API_KEY` and `NUXT_OPENAI_MODEL` to a model available in your OpenAI project. No model name is assumed. The endpoint uses the Responses API with `store: false`, a maximum output length, 30 attempts per account per day, and an additional per-instance rate limit.

Requests contain business name, quote identifier/title, service descriptions, and the pre-calculated total. Customer contact details and addresses are not included. Owners review and edit the output before copying; AI messages are never sent automatically. Provider usage has its own cost.

## Gmail SMTP (free alternative for low-volume email)

Set these server-only values in `.env`:

```env
NUXT_MAIL_PROVIDER=gmail
NUXT_GMAIL_USER=your-address@gmail.com
NUXT_GMAIL_APP_PASSWORD=your-google-app-password
```

Enable Google 2-Step Verification, then create an App Password at https://myaccount.google.com/apppasswords. Use that password, not your normal Google password. Some managed or protected accounts cannot create App Passwords. Spaces in the generated password are accepted. Restart Nuxt after saving. Gmail always sends from `NUXT_GMAIL_USER`; Resend settings are not required in Gmail mode.

Test using a sample customer whose email is your own inbox. Publish its quote link, confirm the recipient checkbox, and click **Send quote email**. Publishing freezes the quote. Check the recipient inbox and Gmail Sent folder. Localhost quote links only open on the machine running the app. For external customers, deploy and configure the public `NUXT_APP_URL` first.

Gmail is subject to account sending limits and hosting must allow outbound TLS SMTP on port 465. SMTP acceptance does not guarantee inbox delivery. Migration 004 reserves quote emails and daily owner summaries atomically before provider submission, across all server instances. An attempted email is not automatically retried, including after a timeout, because acceptance may be uncertain. Check provider logs before any operator-authorized retry. A new customer link creates a new quote-email attempt. SMTP itself does not guarantee exactly-once delivery; the app prevents repeated submissions with the same key. Credentials are global to this app installation; individual workspace owners do not connect separate Gmail accounts.

This configures quote emails and optional reminder summaries; Supabase signup/reset email delivery is configured separately. To switch back to Resend, set `NUXT_MAIL_PROVIDER=resend`.

## Email and follow-up summaries (optional)

Create a Resend account and verify a sending domain. Set `NUXT_RESEND_API_KEY` and `NUXT_MAIL_FROM`. Publish a customer quote link, select the confirmation checkbox, and press **Send quote email**. Only the saved quote customer's email is used. The database reserves one submission attempt per published link (and Resend additionally receives an idempotency key); provider acceptance is not proof of inbox delivery.

For daily reminders:

- Set a strong random `NUXT_CRON_SECRET`.
- Owners opt in through **Email me a daily summary** in Settings.
- Configure your host's scheduler to POST `/api/reminders` with `Authorization: Bearer YOUR_CRON_SECRET` once daily, for example 00:00 UTC / 08:00 Philippine time.

Summaries go to the owner's account email, never automatically to customers. Resend idempotency prevents duplicate provider submissions during its retention window. The initial endpoint handles at most 100 business summaries per run. Add a durable paginated queue before exceeding this volume.

## PayMongo (optional)

Billing currently sells **one month of access with manual renewal**, not automatic recurring debits.

1. Complete PayMongo onboarding and enable QR Ph, the checkout method used here.
2. Set `NUXT_PAYMONGO_SECRET_KEY` to a test key first.
3. Register `/api/billing/webhook` for `checkout_session.payment.paid`.
4. Set `NUXT_PAYMONGO_WEBHOOK_SECRET` to the endpoint's signing secret.
5. Set `NUXT_BILLING_AMOUNT=49900` for ₱499, or change it to your price in centavos.
6. Test checkout, cancellation, webhook retries, invalid signatures, and test/live separation in staging.
7. After applying migration 003, enable the database flag with `update public.app_security_settings set billing_required=true where singleton=true;` and set `NUXT_BILLING_REQUIRED=true` to gate quote publishing, AI, and email on an active trial/paid period. Reading, exporting, and saving records remain available.

New cloud workspaces receive 14 trial days. Successful payment extends access by one calendar month from the later of now or the current period end. Activation requires a signed webhook and server-side receipt lookup. A success redirect never activates access. Each order/event is fulfilled at most once in a database transaction.

Automatic renewal, refunds, chargebacks, and self-service cancellation are not implemented. Establish those processes and verify webhook schemas against your enabled PayMongo API before a public commercial launch. Keep test keys in staging. Test mode is displayed in Settings. No real payment was executed here.

## Deployment

Deploy as a Node/Nitro server, not a static site. Set required `NUXT_*` environment variables in the host dashboard. `NUXT_APP_URL` must exactly match the HTTPS origin; write endpoints check it for CSRF protection. Change this value if using another local port.

```sh
npm install
npm test
npm run typecheck
npm run build
node .output/server/index.mjs
```

Production request quotas are atomic database counters shared by all instances; platform/WAF limits remain useful for network-level traffic floods. Set up database backups and webhook monitoring. The app currently supports one owner per business, without staff accounts or invitations.

## Verification before real customer use

- Run `supabase/tests/isolation.sql` in a disposable project after all four migrations. It rolls back test data and checks owner isolation, immutable sent quotes, stale saves, revocation, and duplicate customer decisions.
- Create two accounts and verify each can only read and change its own data.
- Exercise signup confirmation, recovery, session refresh, logout, and cloud saves with your email configuration.
- Open a quote link in another browser. Test expiry, acceptance, revocation, and refreshing the owner tab.
- Test AI and Resend with sample data, then PayMongo test checkout and retries.
- Check desktop/mobile layouts and printed PDFs.

Local TypeScript, unit tests, and builds run without credentials. SQL integration tests, live provider requests, and browser checks need configured services and runtime access; they have not been run here.

## Documentation

- Supabase: https://supabase.com/docs/guides/auth/passwords
- OpenAI: https://developers.openai.com/api/reference/resources/responses/methods/create
- PayMongo checkout: https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start
- PayMongo signatures: https://docs.paymongo.com/docs/developer-tools-webhook-setup-management
- Resend: https://resend.com/docs/api-reference/emails/send-email
