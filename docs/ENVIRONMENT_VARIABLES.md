# Environment variables

All environment-specific configuration comes from environment variables.

- **Validation:** `src/server/config/env.ts` validates them with Zod. The server refuses to start when a value is invalid (`src/instrumentation.ts`). Errors name the variable but never print its value.
- **Files:**
  - `.env.example` is committed and contains placeholders only.
  - `.env` holds local development values (git-ignored).
  - `.env.test` holds automated-test values; it must point at a `*_test` database (git-ignored).
  - Staging and production use the hosting provider's secret manager or environment settings, not files.
- **Loading:** Next.js loads `.env*` itself. CLI scripts (Prisma, seed, jobs) load `ENV_FILE`, defaulting to `.env`. Variables already set in the process environment always take precedence.
- **Public vs private:** only `NEXT_PUBLIC_*` variables can reach the browser. Nothing secret uses that prefix. The current UI reads no `NEXT_PUBLIC_*` value at runtime; they are reserved for future client-side needs.
- **Feature flags** below default to the safe value when unset.

Legend: **Req** = required, **Opt** = optional, **Cond** = required when the condition in *Depends on* applies. **Priv** = server-only, **Pub** = may be exposed to the browser.

| Variable | Purpose | Req | Class | Example placeholder | Depends on / used by |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Node/Next runtime mode | Opt | Priv | `development` | Set by Next.js |
| `APP_ENV` | Deployment tier: development / test / staging / production | Opt (default development) | Priv | `production` | Production safety checks, seed behavior, robots |
| `APP_NAME` | Site name in UI and emails | Opt | Priv | `Kongu Matrimony` | Layout, emails |
| `APP_URL` | Canonical base URL; used for email links, CSRF origin and the cookie `secure` default | **Req** | Priv | `https://www.example.com` | Auth emails, `apiHandler` origin check |
| `NEXT_PUBLIC_APP_URL` | Public copy of APP_URL for client code | Opt | Pub | `https://www.example.com` | Reserved |
| `NEXT_PUBLIC_APP_NAME` | Public copy of APP_NAME | Opt | Pub | `Kongu Matrimony` | Reserved |
| `SUPPORT_EMAIL` | Address shown on Contact/Privacy pages | Opt | Priv | `support@example.com` | Public pages |
| `DATABASE_URL` | PostgreSQL connection string | **Req** | Priv | `postgresql://USER:PASSWORD@HOST:5432/matrimonial_kongu?schema=public` | Everything |
| `DATABASE_POOL_MAX` | Max connections per app process | Opt (10) | Priv | `10` | DB client |
| `AUTH_SECRET` | HMAC key for one-time tokens/OTPs (≥ 32 chars; generate with `openssl rand -base64 48`) | **Req** | Priv | `REPLACE_WITH_A_STRONG_RANDOM_SECRET` | Email verification, password reset, OTP |
| `SESSION_COOKIE_NAME` | Session cookie name | Opt | Priv | `km_session` | Auth |
| `SESSION_TTL_DAYS` | Sliding session lifetime | Opt (30) | Priv | `30` | Auth |
| `SESSION_COOKIE_SECURE` | Send cookie over HTTPS only; **must be true when deployed** | Cond | Priv | `true` | Auth |
| `MIN_AGE_MALE` / `MIN_AGE_FEMALE` | Legal minimum ages for registration | Opt (21 / 18) | Priv | `21` / `18` | Registration, Terms |
| `CORS_ORIGINS` | Extra origins allowed to call mutating API endpoints (comma-separated) | Opt | Priv | `https://admin.example.com` | `apiHandler` |
| `STORAGE_PROVIDER` | `local` (`s3` not yet implemented) | Opt | Priv | `local` | Photos, documents |
| `STORAGE_LOCAL_DIR` | Directory for uploads; must be a persistent volume in production | Opt | Priv | `/var/lib/kongu/uploads` | Local storage |
| `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Reserved for an object-storage adapter | Opt | Priv | — | Future S3 adapter |
| `MAX_UPLOAD_BYTES` | Max upload size | Opt (5 MiB) | Priv | `5242880` | Media |
| `MAX_PHOTOS_PER_PROFILE` | Photo limit | Opt (6) | Priv | `6` | Media |
| `EMAIL_PROVIDER` | `disabled`, `console` (dev only), `resend` | Opt | Priv | `resend` | All email; must not be `disabled` when deployed with email verification on |
| `EMAIL_API_URL` | Provider API base URL | Cond (`resend`) | Priv | `https://api.resend.com` | Email |
| `EMAIL_API_KEY` | Provider API key | Cond (`resend`) | Priv | `re_xxx` | Email |
| `EMAIL_FROM_ADDRESS` | Sender address | Cond (any provider) | Priv | `Kongu Matrimony <no-reply@example.com>` | Email |
| `SMS_PROVIDER` | `disabled`, `console` (dev only) | Opt | Priv | `disabled` | Phone OTP |
| `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID` | Reserved for an SMS adapter | Opt | Priv | — | Future SMS adapter |
| `PAYMENT_PROVIDER` | `disabled`, `razorpay` | Opt | Priv | `razorpay` | Payments |
| `PAYMENT_API_BASE_URL` | Provider API base URL (from provider docs) | Cond (`razorpay`) | Priv | `https://api.razorpay.com` | Order creation, CSP |
| `PAYMENT_KEY_ID` | Provider key ID; also sent to the browser checkout by the server at checkout time | Cond | Priv | `rzp_live_xxx` | Checkout |
| `PAYMENT_KEY_SECRET` | Provider key secret (checkout signature) | Cond | Priv | — | Checkout verification |
| `PAYMENT_WEBHOOK_SECRET` | Webhook signing secret | Cond | Priv | — | `/api/webhooks/payments/razorpay` |
| `PAYMENT_CHECKOUT_SCRIPT_URL` | Provider browser checkout script URL (from provider docs) | Cond | Priv | `https://checkout.razorpay.com/v1/checkout.js` | Checkout button, CSP |
| `LOG_LEVEL` | `debug`/`info`/`warn`/`error` | Opt | Priv | `info` | Logger |
| `ERROR_TRACKING_PROVIDER` | `none`, `console` (not in production) | Opt | Priv | `none` | Error tracking |
| `ERROR_TRACKING_DSN` | Reserved for a hosted error tracker | Opt | Priv | — | Future adapter |
| `REDIS_URL` | Reserved for a cache/rate-limit adapter | Opt | Priv | — | Not used yet |
| `CDN_BASE_URL` | CDN origin for images (added to CSP) | Opt | Priv | `https://cdn.example.com` | CSP |
| `ANALYTICS_ENDPOINT` | Receives server-side analytics events (JSON POST, no personal data) | Opt | Priv | `https://analytics.example.com/events` | Analytics |
| `ENABLE_EMAIL_VERIFICATION` | Require email verification before publishing or sending interests | Opt (true) | Priv | `true` | Registration |
| `ENABLE_SMS_VERIFICATION` | Enable phone OTP (needs an SMS provider) | Opt (false) | Priv | `false` | Auth |
| `ENABLE_PAYMENTS` | Allow paid checkout (needs a provider) | Opt (false) | Priv | `false` | Membership |
| `ENABLE_HOROSCOPE_FEATURE` | Show the horoscope step and section | Opt (false) | Priv | `false` | Profiles |
| `ENABLE_PROFILE_VERIFICATION` | Allow ID-verification requests | Opt (true) | Priv | `true` | Verification |
| `ENABLE_PROFILE_MODERATION` | New profiles and photos need staff approval | Opt (true) | Priv | `true` | Profiles, media |
| `ACCOUNT_DELETION_GRACE_DAYS` | Days before a deletion request is executed | Opt (14) | Priv | `14` | Privacy |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Development super-admin created by the seed (dev/test only) | Opt | Priv | — | `prisma/seed.ts` |
| `SEED_MEMBER_PASSWORD` | Password for synthetic seed members (dev/test only) | Opt | Priv | — | `prisma/seed.ts` |
| `SEED_REFERENCE_ONLY` | Seed plans/FAQs only | Opt | Priv | `true` | `prisma/seed.ts` |
| `ENV_FILE` | Env file for CLI scripts | Opt | Priv | `.env.test` | Prisma CLI, seed, jobs |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_ROLE` | One-off inputs to `npm run admin:create` (pass inline, never store) | Cond | Priv | — | `scripts/create-admin.ts` |

## Rules enforced at startup

- `APP_ENV=staging|production` requires:
  - an `https://` `APP_URL` and `SESSION_COOKIE_SECURE=true`;
  - no `REPLACE_WITH…` placeholders;
  - no `console` email or SMS provider, and no `console` error tracking;
  - an email provider whenever email verification is on.
- `ENABLE_PAYMENTS=true` requires a payment provider. `PAYMENT_PROVIDER=razorpay` requires all five `PAYMENT_*` values.
- `EMAIL_PROVIDER=resend` requires `EMAIL_API_URL` and `EMAIL_API_KEY`.

## Separate credentials per environment

Use different databases, `AUTH_SECRET`s, payment keys (test vs live) and webhook secrets for development, staging and production. Never copy production credentials into `.env` or `.env.test`.
