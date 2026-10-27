# Kongu Matrimony

A community matrimony website for Kongu Vellalar Gounder families in India and abroad.
Bilingual (English / தமிழ்), mobile-first, privacy-first.

**Stack:** Next.js 16 (App Router, TypeScript) · PostgreSQL · Prisma 7 · Tailwind CSS 4 · Zod · Vitest · Playwright.
It is a modular monolith. The architecture is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

| Area | Documentation |
| --- | --- |
| Architecture and modules | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Database schema and conventions | [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) |
| Environment variables | [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) |
| REST API | [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) |
| Security and privacy | [docs/SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md) |
| Testing | [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) |
| Deployment, backup and restore | [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) |
| What is done and what is pending | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) |

## Local development

Prerequisites: Node.js 22 or later (developed on 24) and PostgreSQL 14 or later (developed on 18).

### 1. Install dependencies

```bash
npm install            # also runs `prisma generate` (postinstall)
```

npm 11 asks before running package install scripts. The approved list is in `package.json` under `allowScripts` (Prisma engines, esbuild, the ESLint resolver).

### 2. Create the local PostgreSQL databases

```bash
createdb -h localhost -U postgres matrimonial_kongu        # development
createdb -h localhost -U postgres matrimonial_kongu_test   # automated tests only
```

### 3. Configure `.env`

```bash
cp .env.example .env
openssl rand -base64 48      # paste the output into AUTH_SECRET
```

Set `DATABASE_URL` to your local database. For the test database, create a `.env.test` file the same way. It must point at the `*_test` database and set `APP_ENV=test`. Every variable is described in [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md). Never commit `.env` or `.env.test`; both are git-ignored.

### 4. Generate the ORM client

```bash
npm run db:generate
```

### 5. Run migrations

```bash
npm run db:migrate                                   # development: applies migrations, prompts for new ones
ENV_FILE=.env.test npx prisma migrate deploy          # test database
```

### 6. Seed synthetic development data

```bash
npm run db:seed
```

The seed creates membership plans, FAQs, and, in development and test only, 40 fictional members plus a super-admin.

- Member logins use `@example.invalid` addresses with password `Member@12345`, or `SEED_MEMBER_PASSWORD` if set.
- The admin login comes from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

### 7. Start the application

```bash
npm run dev            # http://localhost:3000
```

The health check is at <http://localhost:3000/api/health>.

### 8. Run automated tests

```bash
npm test               # unit + PostgreSQL integration tests (uses .env.test)
npm run build && npm run test:e2e   # browser end-to-end tests on port 3100
npm run check          # typecheck, lint, format check, tests, production build
```

### 9. Build for production

```bash
npm run build && npm start
```

### 10. Staging and production

See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md). In short:

- Provide secrets through the host's secret manager.
- Set `APP_ENV=staging` or `APP_ENV=production` and `SESSION_COOKIE_SECURE=true`.
- Run `npm run db:deploy`. Never run `migrate dev` or `migrate reset` against a deployed database.
- Run `SEED_REFERENCE_ONLY=true npm run db:seed` once.
- Create staff accounts with `npm run admin:create`.
- Schedule `npm run jobs` hourly.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run db:status` | Show migration status |
| `npm run db:studio` | Browse data (development only) |
| `npm run jobs` | Expire subscriptions, erase accounts past their deletion grace period, clean up sessions and tokens |
| `npm run admin:create` | Create or promote a staff account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_ROLE` |
| `npm run format` | Format with Prettier |
