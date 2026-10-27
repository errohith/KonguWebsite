@AGENTS.md

# Kongu Matrimony — working notes for Claude Code

## Commands
- `npm run dev` runs the dev server on :3000 (uses `.env` → database `matrimonial_kongu`).
- `npm test` runs unit and integration tests (uses `.env.test` → `matrimonial_kongu_test`; refuses any database not named `*_test`).
- `npm run build && npm run test:e2e` runs Playwright against `next start` on :3100 with the test database.
- `npm run check` runs typecheck, lint, Prettier check, tests and build. Run it before you report a task as done.
- After a schema change: `npx prisma migrate dev --name <change>`, then `ENV_FILE=.env.test npx prisma migrate deploy`.
- The Prisma CLI loads env from `ENV_FILE` (default `.env`) via `scripts/lib/load-env.ts`.

## Architecture rules
- Business logic lives in `src/server/modules/<module>/`. Pages, server actions (`src/server/actions`) and API routes (`src/app/api`) stay thin and call services.
- Read configuration only through `getEnv()` (`src/server/config/env.ts`), never `process.env`. Exceptions: `src/proxy.ts` and CLI scripts. New variables go in the zod schema, `.env.example`, `.env.test` and `docs/ENVIRONMENT_VARIABLES.md`.
- External services are reached only through adapters in `src/server/integrations/*`. If a provider is not configured, throw `AppError("SERVICE_UNAVAILABLE" | "FEATURE_DISABLED")`. Never return a fake success.
- Services throw `AppError(code, "errors.<i18nKey>")`. `runAction` (server actions) and `apiHandler` (routes) translate these into responses.
- Profile, photo and contact authorization has one source of truth: `decideAccess` in `src/server/modules/profiles/access.ts`. Do not reimplement it in pages.
- Contact details (`ProfileContact`) are never selected except in `revealContact` and the owner's own views.
- Entitlements come from `getEntitlements()`. They compare `endsAt` with now and do not depend on the expiry job.
- Money is `Decimal`. Convert with `toMinorUnits()` and never with floats.
- Admin mutations write `audit()` inside the same transaction.
- Every server module imports `"server-only"`. Client components import types only from `src/lib/*`.

## UI / i18n
- Every member-facing string goes through `t()`. Add each key to both `src/i18n/messages/en.ts` and `ta.ts`; the type enforces parity and a unit test re-checks it. The admin area is English-only.
- Forms use `ActionForm` / `Field` from `src/components/ui/form.tsx`. Zod messages are i18n keys (`"errors.required"`).
- `cacheComponents` is off on purpose. Every route renders dynamically, so private data can't leak through caching.

## Next.js 16 specifics
- `middleware` is now `src/proxy.ts`. `params`, `searchParams` and `cookies()` are async. Use `refresh()` from `next/cache` after mutations in server actions. Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
