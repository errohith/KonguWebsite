/**
 * Scheduled maintenance. Run from cron / your host's scheduler, e.g. hourly:
 *
 *   npm run jobs            # all jobs
 *   npm run jobs -- expire  # one job
 *
 * Jobs are idempotent and safe to run concurrently with the app.
 */
import { loadEnvFile } from "./lib/load-env";

loadEnvFile();

async function main() {
  const { db } = await import("@/server/db/client");
  const { expireSubscriptions } = await import("@/server/modules/payments/service");
  const { processDueDeletions } = await import("@/server/modules/privacy/service");

  const jobs: Record<string, () => Promise<string>> = {
    expire: async () => `expired subscriptions: ${await expireSubscriptions()}`,
    deletions: async () => `accounts erased: ${await processDueDeletions()}`,
    cleanup: async () => {
      const now = new Date();
      const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
      const tokens = await db.verificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }] },
      });
      const buckets = await db.rateLimitBucket.deleteMany({
        where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } },
      });
      return `cleanup: sessions=${sessions.count} tokens=${tokens.count} rateLimitBuckets=${buckets.count}`;
    },
  };

  const selected = process.argv.slice(2).filter((a) => a in jobs);
  for (const name of selected.length ? selected : Object.keys(jobs)) {
    console.log(`[jobs] ${await jobs[name]()}`);
  }
  await db.$disconnect();
}

main().catch((err) => {
  console.error("[jobs] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
