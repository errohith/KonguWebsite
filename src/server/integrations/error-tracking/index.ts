import { getEnv } from "@/server/config/env";
import { logger, redact } from "@/server/lib/logger";

/**
 * Error reporting seam. "none" logs a structured error line; "console" also
 * prints the stack (local debugging). Wire a hosted provider here using
 * ERROR_TRACKING_DSN once one is chosen.
 */
export function captureException(error: unknown, context: Record<string, unknown> = {}) {
  let provider = "none";
  try {
    provider = getEnv().ERROR_TRACKING_PROVIDER;
  } catch {
    // configuration itself may be the failure
  }
  logger.error("unhandled_error", { ...context, error });
  if (provider === "console" && error instanceof Error) {
    console.error(error.stack, redact(context));
  }
}
