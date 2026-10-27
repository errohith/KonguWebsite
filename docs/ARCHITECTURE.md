# Architecture

## Overview

A single Next.js 16 application, organized as a **modular monolith**. Each module owns its validation, business rules and persistence. The web layer (pages, server actions, REST routes) is a thin adapter over those modules.

```
Browser ──► src/proxy.ts (per-request CSP nonce, x-pathname)
        ──► App Router pages (Server Components)      ─┐
        ──► Server Actions  (src/server/actions/*)     ├──► Modules (src/server/modules/*) ──► Prisma ──► PostgreSQL
        ──► REST routes     (src/app/api/*)            ─┘            │
                                                                     └──► Integrations (email, sms, payments, storage, analytics, error tracking)
```

### Why these choices

| Decision | Reason |
| --- | --- |
| Next.js App Router plus server actions | One deployable unit. Forms work without client-side state libraries. Server Components keep private data on the server. |
| **Prisma 7** with `@prisma/adapter-pg` | Typed queries, a declarative schema, version-controlled migrations, and a first-class `pg` driver with pooling. Raw SQL is used where Prisma has no equivalent (advisory locks, atomic rate-limit upserts, CHECK constraints). Prisma 8 was still a release candidate when this project started. |
| Custom session auth (DB sessions plus Argon2id) instead of an auth library | Email/password and OTP flows only. Server-side revocable sessions are needed (suspension, password reset, deletion). A small, fully tested implementation avoids coupling to a library's env and schema conventions. |
| `cacheComponents: false` | Nearly every page is per-member and privacy-sensitive. Fully dynamic rendering removes the risk of caching one member's data into a shared shell. |
| PostgreSQL rate limiting | Works across instances without requiring Redis. `REDIS_URL` is reserved for a future cache adapter. |
| Cookie-based locale (`km_locale`) instead of locale-prefixed URLs | Members switch language without changing URLs. Public pages are bilingual. |

## Directory layout

```
prisma/                schema.prisma, migrations/, seed.ts
scripts/               jobs.ts (cron), create-admin.ts, lib/load-env.ts
src/
  proxy.ts             CSP nonce + security headers (Next 16 "proxy", formerly middleware)
  instrumentation.ts   validates env at startup; onRequestError → error tracking
  app/
    (public)/          home, about, how-it-works, membership, faq, contact, safety, privacy, terms
    (auth)/            login, register, forgot/reset password, verify-email
    (member)/          dashboard, profile/edit/[step], profiles/[publicId], search, matches,
                       interests, shortlist, settings, verification, notifications, support, membership/history
    admin/             staff area (role-gated)
    api/               REST endpoints (see API_DOCUMENTATION.md)
  components/          ui/ (design system), layout/, profile/, member/, admin/, …
  i18n/                en.ts / ta.ts dictionaries, server + client translators
  lib/                 isomorphic helpers (enum option lists, public-ID format, ActionState type)
  generated/prisma/    generated client (git-ignored)
  server/
    config/env.ts      the only place that reads process.env
    db/                Prisma client singleton, health check
    lib/               errors, logger (redacting), crypto, dates, rate limit, audit, validation helpers
    http/              runAction (server actions) and apiHandler (REST) error mapping, CSRF origin check
    integrations/      provider adapters
    actions/           "use server" entry points
    modules/
      auth/            passwords, sessions, registration/login/verification/reset, permissions (RBAC)
      profiles/        multi-step profile, completeness, access rules (decideAccess), contact reveal
      discovery/       search, matches, profile cards
      interests/       interests + shortlists
      privacy/         blocks, reports, deactivate/delete/erase, data export
      media/           photo + document upload (magic-byte sniffing), authorised reads
      moderation/      profile/photo review, verification requests, report handling
      membership/      plans, entitlements
      payments/        checkout, signature verification, idempotent webhooks, refunds, expiry
      notifications/   in-app notifications + email templates (en/ta)
      support/         tickets
      content/         admin-editable content blocks + FAQs
      admin/           member management, listings, stats
```

## Request flows

**Server action:** form → `ActionForm` (client) → `"use server"` function → `assertActionUser()` (authentication, active status, permission) → module service → `refresh()`. Errors become an `ActionState` with translated messages through `runAction`.

**REST route:** `apiHandler` checks `Origin` for mutating methods (CSRF), resolves the session cookie, calls the service, and maps `AppError` to an HTTP status and a JSON error envelope.

**Payments:**

1. Browser → `startCheckout`: a local `Payment` (status CREATED) plus a provider order.
2. The provider checkout runs in the browser.
3. `confirmCheckout` verifies the HMAC signature and captures idempotently.
4. Webhooks, also HMAC-verified and deduplicated on `(provider, eventId)`, capture or refund the same payment idempotently.

Subscription activation is guarded by the conditional update `status IN (CREATED, FAILED)`, plus a unique constraint on `Subscription.paymentId`.

## Integrations

| Adapter | Implementations | When not configured |
| --- | --- | --- |
| Email | `disabled`, `console` (dev only), `resend` | Throws `SERVICE_UNAVAILABLE`. Registration still succeeds and the UI says the email was not sent. |
| SMS / OTP | `disabled`, `console` (dev only) | OTP endpoints return `FEATURE_DISABLED`. |
| Payments | `razorpay` | Checkout returns `FEATURE_DISABLED`; the UI shows "payments not enabled". |
| Storage | `local` (outside `public/`, served through authorized routes) | — (`s3` rejected at startup until implemented) |
| Analytics | HTTP POST to `ANALYTICS_ENDPOINT` | No-op |
| Error tracking | `none` / `console` | Structured error log |

To add a provider: implement the interface in `src/server/integrations/<kind>/index.ts`, add it to the env enum, and document its variables.
