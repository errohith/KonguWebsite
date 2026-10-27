# Deployment guide

The app is a standard Node.js Next.js server (`next build` then `next start`) backed by PostgreSQL. It runs on any Node host: a VM with systemd/PM2, a container platform, or a PaaS with persistent storage.

> **Storage:** the only implemented file storage is `local`. Uploads need a **persistent volume** at `STORAGE_LOCAL_DIR`, and multiple app instances must share it (for example NFS). Use a single instance, or implement the S3 adapter, before scaling horizontally or deploying to ephemeral/serverless hosts.

## Environments

| | Development | Staging | Production |
| --- | --- | --- | --- |
| `APP_ENV` | development | staging | production |
| Database | local `matrimonial_kongu` | separate staging DB | production DB |
| Secrets | `.env` | host secret manager | host secret manager |
| Payment keys | none / test keys | provider **test** keys | provider **live** keys |
| Email | `console` | real provider (test recipients) | real provider |
| Seed | full synthetic | reference only | reference only |

## First deployment checklist

1. Provision PostgreSQL 14 or later with TLS and automated backups. Create an app role with least privilege (owner of the app schema; not a superuser).
2. Set every required variable from [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md):
   - `APP_ENV=production`, an `https://` `APP_URL`, `SESSION_COOKIE_SECURE=true`;
   - a new `AUTH_SECRET`;
   - an email provider;
   - `LOG_LEVEL=info`.
3. Build: `npm ci && npm run build`. Note that `postinstall` runs `prisma generate`.
4. Migrate: `npm run db:deploy`.
5. Reference data: `SEED_REFERENCE_ONLY=true npm run db:seed`. Plans are only inserted when missing; edit prices in Admin → Plans afterwards.
6. Create staff: `ADMIN_EMAIL=… ADMIN_PASSWORD='…' ADMIN_ROLE=SUPER_ADMIN npm run admin:create`.
7. Start: `npm start` (port from `PORT`, default 3000) behind a TLS-terminating reverse proxy that sets `X-Forwarded-For`.
8. Schedule jobs hourly: `npm run jobs`. This expires subscriptions, erases accounts past their grace period and cleans up sessions and tokens.
9. Monitoring: probe `GET /api/health` (returns 503 when the DB is unreachable) and alert on `"level":"error"` log lines.
10. Review the legal pages with a lawyer and replace placeholder contact details (`SUPPORT_EMAIL`, Admin → Content).

## Enabling payments (Razorpay)

Keep `ENABLE_PAYMENTS=false` until business details are final.

1. Verify the endpoints and signature scheme against the provider's current documentation. The adapter in `src/server/integrations/payments/index.ts` documents what it assumes.
2. In the Razorpay dashboard, enable **automatic capture**. Create a webhook pointing to `${APP_URL}/api/webhooks/payments/razorpay` with events `payment.captured`, `payment.failed`, `refund.processed`, and the webhook secret.
3. Set `PAYMENT_PROVIDER=razorpay`, `PAYMENT_API_BASE_URL`, `PAYMENT_KEY_ID`, `PAYMENT_KEY_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_CHECKOUT_SCRIPT_URL`, then `ENABLE_PAYMENTS=true`. Restart.
4. On staging with **test keys**, run a successful payment, a failed payment, a duplicate webhook delivery and a refund. Check Admin → Payments → Reconciliation.

## Safe migrations

- Only `prisma migrate deploy` touches deployed databases. Never `migrate dev`, `migrate reset` or `db push`.
- Take a backup immediately before migrating production.
- Apply to staging first, using a recent anonymized copy where possible.
- Prefer expand/contract changes: add a nullable column, deploy code that writes both, backfill, then make it required in a later migration.
- Long-running index builds: write `CREATE INDEX CONCURRENTLY` in a dedicated migration.

## Backups and restoration

**Daily logical backup** (keep 30 days; copy off-site, encrypted):

```bash
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="kongu-$(date -u +%Y%m%dT%H%MZ).dump"
tar czf uploads-$(date -u +%Y%m%d).tgz -C "$STORAGE_LOCAL_DIR" .     # uploaded photos/documents
```

Managed PostgreSQL providers usually also offer point-in-time recovery; enable it.

**Restore** into a new, empty database, verify it, then switch `DATABASE_URL`:

```bash
createdb kongu_restore
pg_restore --no-owner --dbname=postgresql://…/kongu_restore kongu-YYYYMMDDTHHMMZ.dump
DATABASE_URL=postgresql://…/kongu_restore npx prisma migrate status   # must report "up to date"
tar xzf uploads-YYYYMMDD.tgz -C "$STORAGE_LOCAL_DIR"
```

Test a restore at least quarterly. Erased accounts stay erased: re-run `npm run jobs -- deletions` after restoring an older backup.

## Rollback

Deploy the previous build. Migrations are forward-only, so a schema rollback means writing a new corrective migration (or restoring the pre-deploy backup if data was not yet written).
