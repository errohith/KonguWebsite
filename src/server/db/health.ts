import "server-only";
import { getDb } from "@/server/db/client";

export type DbHealth = { ok: true; latencyMs: number } | { ok: false; latencyMs: number; error: string };

/**
 * Verifies connectivity with a trivial query. The error returned is a
 * generic category, never the driver message (which can include host names).
 */
export async function checkDatabaseHealth(timeoutMs = 3_000): Promise<DbHealth> {
  const started = Date.now();
  try {
    await Promise.race([
      getDb().$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error && err.message === "timeout" ? "timeout" : "unreachable";
    return { ok: false, latencyMs: Date.now() - started, error: message };
  }
}
