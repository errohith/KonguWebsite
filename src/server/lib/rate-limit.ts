import "server-only";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";

/**
 * Fixed-window rate limiter backed by PostgreSQL (atomic upsert), so limits
 * hold across multiple app instances without requiring Redis.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number) {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" < now() - make_interval(secs => ${windowSeconds})
        THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."windowStart" < now() - make_interval(secs => ${windowSeconds})
        THEN now() ELSE "RateLimitBucket"."windowStart" END
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 0);
  return { allowed: count <= limit, count };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const { allowed } = await hitRateLimit(key, limit, windowSeconds);
  if (!allowed) throw new AppError("RATE_LIMITED");
}
