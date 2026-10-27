# Project status

_Last updated: 2026-10-27. Statuses below were verified by running the commands listed, unless marked otherwise._

## Verified

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | passes |
| `npm run lint` (`--max-warnings=0`) | passes |
| `npm run format:check` | passes |
| `npm test`: unit (36) + PostgreSQL integration (40) | 76/76 pass against `matrimonial_kongu_test` |
| `npm run test:e2e`: Playwright, desktop + mobile | 10/10 pass against the production build |
| `npm run build` | passes (all routes dynamic) |
| Migrations applied to `matrimonial_kongu` and `matrimonial_kongu_test` | yes (2 migrations) |
| Seed + `npm run jobs` against the dev database | yes |
| Manual smoke test on the dev server | Public pages, health check, CSP headers; member search/profile/interest/contact rules; photo upload (type sniffing, authorized serving); admin moderation with audit entries |

## Phase completion

| Phase | Status |
| --- | --- |
| 1. Repository inspection | Done (empty repo; stack chosen) |
| 2. Architecture, schema, migrations, env config | Done |
| 3. Auth, authorization, profiles | Done |
| 4. Search, discovery, interests, privacy | Done |
| 5. Verification, reporting, administration | Done |
| 6. Membership and payments | Implemented and tested with a stubbed provider. **Not verified against real Razorpay**: no credentials; `ENABLE_PAYMENTS=false`. |
| 7. Notifications, support, localization, responsive UI | Done. Email is verified only with the `console` provider. |
| 8. Tests, security review, performance checks | Tests done. Security controls documented. No load testing yet. |
| 9. Deployment documentation, backup/restore | Documented. **No deployment performed.** |

## Not done / known limitations

- **Payments:** Razorpay adapter written from the documented API; must be verified on staging with test keys before enabling.
- **Email:** only the `console` (dev) and `resend` adapters exist; `resend` has not been run against the real service.
- **SMS / OTP:** service logic exists, but there is no real SMS provider adapter and no OTP UI (`ENABLE_SMS_VERIFICATION=false`).
- **Storage:** the `local` adapter only. An S3-compatible adapter is needed for multi-instance or serverless hosting.
- **Images:** no resizing or EXIF stripping (consider `sharp`) and no watermarking.
- **Tamil translations:** written for UI; need review by a native speaker from the community. Legal pages are English-only templates and **require legal review**.
- **Horoscope:** stored and displayed when `ENABLE_HOROSCOPE_FEATURE=true`; no porutham (compatibility) matching.
- **Messaging/chat** between members is not implemented (contact is via unlocked contact details).
- **Error tracking:** structured logs only; no hosted provider wired up.
- **Admin UI** is English-only.
- **Upstream warning:** a `pg` deprecation warning from Prisma's transaction handling appears in test output (see TESTING_GUIDE).
- Not committed to git yet. The repository contains only the create-next-app initial commit.

## Suggested next steps

1. Native-speaker review of `src/i18n/messages/ta.ts`; legal review of the privacy and terms pages.
2. Choose and configure an email provider; test verification and reset emails end-to-end on staging.
3. Staging deployment with Razorpay test keys; run the payment checklist in DEPLOYMENT_GUIDE.
4. S3-compatible storage adapter and image processing.
5. CI pipeline running `npm run check` and the E2E suite against a disposable PostgreSQL.
