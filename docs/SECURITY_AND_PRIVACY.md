# Security and privacy

## Threat model highlights

A matrimony site holds sensitive personal data: photos, family details, contact numbers and ID documents. The main risks are:

- scraping;
- unauthorized contact harvesting;
- impersonation and fraud;
- account takeover;
- payment fraud;
- leaking private data through caching or API over-fetching.

## Controls

### Authentication and sessions
- Passwords are hashed with Argon2id (19 MiB, t=2). Login takes the same time whether or not the account exists.
- Sessions are opaque random tokens in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` when deployed). Only their SHA-256 hash is stored. Sessions have a sliding 30-day expiry and are revoked on logout, password reset or change (other devices), suspension, role change and deletion request.
- Accounts lock for 15 minutes after 5 failed logins. Login, registration, password reset, uploads, reports, tickets, checkout and export are rate-limited (PostgreSQL buckets).
- Email-verification and reset tokens are single-use, time-limited and stored as HMAC(AUTH_SECRET). OTPs allow at most 5 attempts.
- Password reset never reveals whether an email is registered.
- The adult eligibility check is server-side (21+ men, 18+ women per PCMA 2006, configurable). The date of birth is never shown; only the age is.

### Authorization
- **Role-based access control** for staff (`SUPPORT`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`). See `src/server/modules/auth/permissions.ts`. Every admin page *and* every admin action checks its own permission.
- **Profile access** has a single rule engine, `decideAccess()`, with full unit coverage. Members see only published, active, opposite-gender, unblocked profiles. Visibility settings are enforced: all members / premium only / hidden except accepted interests.
- **Photo visibility:** all members, accepted interests only, or nobody. Photos are served only through an authorized route, never from `public/`.
- **Contact details** live in a separate table. They are released only by `revealContact()` after an accepted interest *and* with a plan that includes contacts, within quota. Each unlock is recorded.
- Members cannot see others' user IDs, emails, dates of birth or documents. API responses are explicit DTOs.
- Inaccessible resources return `404` (not `403`), so their existence isn't revealed.

### Input and output handling
- Every input is validated on the server with Zod. Prisma parameterizes all queries; raw SQL uses tagged templates only.
- Upload types are detected from file contents (magic bytes), not the client's declared type. There are size and count limits, and storage keys are generated server-side and path-validated.
- React escapes all output. There is no `dangerouslySetInnerHTML`.

### Transport and browser
- Content-Security-Policy: per-request nonce plus `strict-dynamic` for scripts. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- Other headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and HSTS when `APP_URL` is HTTPS.
- CSRF: Server Actions get Next.js origin checks. REST mutations require an allowed `Origin`.
- Non-production deployments send `noindex` and `robots.txt` disallows everything.

### Payments
- Prices come only from the database. Amount and currency are re-checked on capture.
- Checkout success requires a valid provider HMAC signature. Webhooks require a valid HMAC over the raw body. Webhook event IDs are deduplicated, and capture is idempotent, so double activation is impossible.
- The UI never claims success until the server has verified the payment.

### Secrets and configuration
- `.env` and `.env.*` are git-ignored; only `.env.example` with placeholders is committed. Config validation fails fast and never prints values.
- The logger redacts keys matching password, secret, token, cookie, key, OTP, signature, DSN and database URL.
- Before every commit, check for secrets: `git diff --cached | grep -iE "secret|password|api_key|DATABASE_URL=postgres"`.

### Audit
- Staff actions (moderation, verification, suspension, role changes, refunds, plan and content edits, erasure) are written to `AuditLog` in the same transaction as the change.

## Privacy workflows (DPDP Act 2023 oriented)

| Right | Implementation |
| --- | --- |
| Access / portability | Settings → Download your data (`GET /api/account/export`, JSON) |
| Correction | Profile editor |
| Withdraw / pause | Deactivate (profile hidden; reactivate by logging in) |
| Erasure | Settings → Delete. The profile is hidden immediately; personal data is erased after `ACCOUNT_DELETION_GRACE_DAYS` by `npm run jobs`. Payment records are retained, anonymized. Admins can erase immediately. |
| Safety | Block, report, moderation queue, Safety guidelines page |

The legal pages are **templates** and must be reviewed by a lawyer before launch.
