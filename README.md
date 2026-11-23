# QuoteFollow PH

Nuxt 4 + Vue + TypeScript app for Philippine cleaning businesses.

## Start

```sh
npm install
npm run dev
```

Supabase configuration and sign-in are required. Until configured, the app shows a setup screen. Follow **[SETUP.md](SETUP.md)** and configure `.env` from `.env.example`.

## Implemented

- Responsive dashboard with readable 14–16px text and 16px inputs.
- Customer records, service rates, business profile, terms, and backup exports.
- Quotes with centavo calculations, discounts, tax, draft editing, expiry, revisions, and print-to-PDF.
- Follow-up reminders and English/Filipino message templates.
- Supabase signup, confirmation, login/logout, session refresh, and password recovery with HttpOnly cookies.
- Cloud saves with optimistic concurrency, owner-level RLS, and immutable sent quote contents.
- Revocable customer links, frozen quote snapshots, accept/decline responses, and audit records.
- Optional AI drafting with owner review and daily quotas.
- Optional quote emails and opt-in scheduled owner reminders via Resend or Gmail SMTP.
- PayMongo one-month checkout, signed webhooks, receipt verification, idempotent fulfillment, trials, and optional paid-feature enforcement.

## Not yet live or complete

External services need your accounts, credentials, database migrations, and staging verification. No Supabase project or provider account was configured here. No live email, AI request, or payment was sent. This is not a verified production deployment.

Monthly billing currently requires manual renewal. Automatic recurring debits, refunds/chargeback handling, staff accounts, recipient identity verification, and logo uploads are not implemented. PDF export uses the browser print dialog.

The UI uses local Vue primitives with shadcn-style design. Official shadcn-vue/Reka components are not integrated.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Node tests cover currency math, expiry/reminders, immutability, workspace validation, and payment signatures. `supabase/tests/isolation.sql` is a separate database integration test to run against a disposable Supabase project after migrations.

## Environment note

Dependencies are installed locally for this project. Gmail SMTP configuration is documented in SETUP.md.

This execution environment restricts listening ports and Docker access. Browser QA and database integration tests require a suitable local environment or staging deployment.
