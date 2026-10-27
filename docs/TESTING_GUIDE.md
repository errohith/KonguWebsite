# Testing guide

| Layer | Tool | Location | Database |
| --- | --- | --- | --- |
| Unit | Vitest (`--project unit`) | `tests/unit/` | none |
| PostgreSQL integration and API | Vitest (`--project integration`) | `tests/integration/` | `matrimonial_kongu_test` |
| Browser end-to-end | Playwright | `tests/e2e/` | `matrimonial_kongu_test` |

## Setup (once)

```bash
createdb -h localhost -U postgres matrimonial_kongu_test
# create .env.test (see README); it must set APP_ENV=test and a *_test DATABASE_URL
ENV_FILE=.env.test npx prisma migrate deploy
npx playwright install chromium
```

**Safety:** `tests/helpers/setup-db.ts` refuses to run unless the database name ends with `_test` and `APP_ENV=test`. E2E global setup applies the same check. Tests load `.env.test` with override, so your `.env` is never used.

## Running

```bash
npm test                    # unit + integration (serial, ~3 s)
npm run test:unit
npm run test:integration
npm run build && npm run test:e2e    # starts `next start -p 3100` with .env.test
npm run check               # everything, including lint/typecheck/format/build
```

## Coverage by requirement

| Requirement | Tests |
| --- | --- |
| Missing / invalid env vars, production rules, secrets not printed | `unit/env.test.ts` |
| Invalid database config / PostgreSQL connection failure | `unit/env.test.ts` (URL validation), `integration/api.test.ts` (health check against an unreachable server) |
| Unauthorized profile access (gender, hidden, premium, blocked, drafts, suspended) | `unit/access.test.ts`, `integration/privacy-access.test.ts`, `integration/api.test.ts` |
| Unauthorized contact-detail access and quota | `unit/access.test.ts`, `integration/privacy-access.test.ts` |
| Duplicate payment webhooks, forged events, amount mismatch, refunds | `unit/payments-provider.test.ts`, `integration/payments.test.ts` |
| Membership entitlement enforcement (interest quota, contacts, expiry) | `integration/interests.test.ts`, `integration/privacy-access.test.ts`, `integration/payments.test.ts` |
| Failed external services (email provider down, payment API 500/network) | `integration/auth.test.ts`, `unit/payments-provider.test.ts` |
| Account deletion and data retention, export, deactivation | `integration/lifecycle.test.ts` |
| Auth: adult eligibility, verification, lockout, reset, suspension | `integration/auth.test.ts` |
| Duplicate-interest prevention (including concurrent requests) | `integration/interests.test.ts` |
| CSRF origin checks, 401/404 behavior | `integration/api.test.ts` |
| i18n key parity (en/ta), upload type sniffing, log redaction | `unit/misc.test.ts` |
| UI: language switch, responsive overflow, registration, search → profile → interest, RBAC 403, no console/CSP errors | `e2e/*.spec.ts` |

## Writing tests

- Use `tests/helpers/factory.ts` (`createMember`, `giveGold`, `acceptedInterest`).
- Each integration file starts from a truncated database with `FREE` (2 interests/day) and `GOLD` (1 contact view) plans.
- External providers: use the test seams `setEmailProviderForTests`, `setPaymentProviderForTests` and `setSmsProviderForTests`, or `vi.stubGlobal("fetch", …)`. Tests never call real providers.

## Known noise

Prisma 7's query interpreter can issue overlapping reads on a transaction connection. With `pg` 8.x this logs `DeprecationWarning: Calling client.query() when the client is already executing a query`. It comes from inside `@prisma/client`, not application code, and is harmless; re-check after upgrading Prisma.
