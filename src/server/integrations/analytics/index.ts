import "server-only";
import { getEnv } from "@/server/config/env";
import { logger } from "@/server/lib/logger";
import { fetchWithTimeout } from "../http";

/**
 * Server-side product analytics. Events carry no personal data (no names,
 * emails, phone numbers). Failures are logged and never affect the request.
 */
export function track(event: string, properties: Record<string, string | number | boolean> = {}) {
  const endpoint = getEnv().ANALYTICS_ENDPOINT;
  if (!endpoint) return;
  void fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties, timestamp: new Date().toISOString() }),
    timeoutMs: 3_000,
  }).catch((err) => logger.warn("analytics.failed", { event, error: err }));
}
