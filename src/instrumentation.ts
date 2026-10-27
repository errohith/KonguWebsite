import type { Instrumentation } from "next";

/**
 * Runs once when a server instance starts. Validates configuration so a
 * misconfigured deployment fails immediately with a clear message (variable
 * names only — values are never printed) instead of on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv, ConfigError } = await import("@/server/config/env");
  try {
    const env = getEnv();
    console.info(
      `[startup] ${env.APP_NAME} env=${env.APP_ENV} email=${env.EMAIL_PROVIDER} sms=${env.SMS_PROVIDER} ` +
        `payments=${env.ENABLE_PAYMENTS ? env.PAYMENT_PROVIDER : "disabled"} storage=${env.STORAGE_PROVIDER}`,
    );
  } catch (err) {
    // Throwing from register() prevents the server from accepting requests.
    if (err instanceof ConfigError) console.error(`\n[startup] ${err.message}\n`);
    throw err;
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { captureException } = await import("@/server/integrations/error-tracking");
  captureException(err, {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    digest: typeof err === "object" && err && "digest" in err ? String(err.digest) : undefined,
  });
};
