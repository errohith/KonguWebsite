import { z } from "zod";

/**
 * Central, validated server configuration.
 *
 * Every environment-specific value the server uses is read here and nowhere
 * else. Code must call `getEnv()` rather than touching `process.env`.
 * Error messages name variables but never print their values.
 */

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}\n` +
        `See .env.example and docs/ENVIRONMENT_VARIABLES.md.`,
    );
    this.name = "ConfigError";
  }
}

const bool = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : v === "true" || v === "1"));

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const optionalUrl = optionalString.pipe(z.url().optional());

const int = (fallback: number, min = 0) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : Number(v)))
    .pipe(z.number().int().min(min));

const PLACEHOLDER = /REPLACE_WITH|YOUR_LOCAL_PASSWORD|CHANGE_ME/i;

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_NAME: z.string().min(1).default("Kongu Matrimony"),
    APP_URL: z.url(),
    SUPPORT_EMAIL: z.email().default("support@example.invalid"),

    DATABASE_URL: z
      .string()
      .min(1)
      .refine((v) => /^postgres(ql)?:\/\//.test(v), "must be a postgresql:// connection string"),
    DATABASE_POOL_MAX: int(10, 1),

    AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    SESSION_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("km_session"),
    SESSION_TTL_DAYS: int(30, 1),
    SESSION_COOKIE_SECURE: bool(false),
    MIN_AGE_MALE: int(21, 18),
    MIN_AGE_FEMALE: int(18, 18),

    CORS_ORIGINS: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),

    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default("./storage/uploads"),
    STORAGE_BUCKET: optionalString,
    STORAGE_REGION: optionalString,
    STORAGE_ENDPOINT: optionalUrl,
    STORAGE_ACCESS_KEY: optionalString,
    STORAGE_SECRET_KEY: optionalString,
    MAX_UPLOAD_BYTES: int(5 * 1024 * 1024, 1024),
    MAX_PHOTOS_PER_PROFILE: int(6, 1),

    EMAIL_PROVIDER: z.enum(["disabled", "console", "resend"]).default("disabled"),
    EMAIL_API_URL: optionalUrl,
    EMAIL_API_KEY: optionalString,
    EMAIL_FROM_ADDRESS: optionalString,

    SMS_PROVIDER: z.enum(["disabled", "console"]).default("disabled"),
    SMS_API_URL: optionalUrl,
    SMS_API_KEY: optionalString,
    SMS_SENDER_ID: optionalString,

    PAYMENT_PROVIDER: z.enum(["disabled", "razorpay"]).default("disabled"),
    PAYMENT_API_BASE_URL: optionalUrl,
    PAYMENT_KEY_ID: optionalString,
    PAYMENT_KEY_SECRET: optionalString,
    PAYMENT_WEBHOOK_SECRET: optionalString,
    PAYMENT_CHECKOUT_SCRIPT_URL: optionalUrl,

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    ERROR_TRACKING_PROVIDER: z.enum(["none", "console"]).default("none"),
    ERROR_TRACKING_DSN: optionalString,

    REDIS_URL: optionalString,
    CDN_BASE_URL: optionalUrl,
    ANALYTICS_ENDPOINT: optionalUrl,

    ENABLE_EMAIL_VERIFICATION: bool(true),
    ENABLE_SMS_VERIFICATION: bool(false),
    ENABLE_PAYMENTS: bool(false),
    ENABLE_HOROSCOPE_FEATURE: bool(false),
    ENABLE_PROFILE_VERIFICATION: bool(true),
    ENABLE_PROFILE_MODERATION: bool(true),

    ACCOUNT_DELETION_GRACE_DAYS: int(14, 0),
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const deployed = env.APP_ENV === "production" || env.APP_ENV === "staging";

    if (deployed) {
      if (PLACEHOLDER.test(env.AUTH_SECRET)) issue("AUTH_SECRET", "still contains a placeholder");
      if (PLACEHOLDER.test(env.DATABASE_URL)) issue("DATABASE_URL", "still contains a placeholder");
      if (!env.APP_URL.startsWith("https://")) issue("APP_URL", "must use https:// when deployed");
      if (!env.SESSION_COOKIE_SECURE) issue("SESSION_COOKIE_SECURE", "must be true when deployed");
      if (env.EMAIL_PROVIDER === "console") issue("EMAIL_PROVIDER", "'console' is only allowed in development");
      if (env.SMS_PROVIDER === "console") issue("SMS_PROVIDER", "'console' is only allowed in development");
      if (env.ENABLE_EMAIL_VERIFICATION && env.EMAIL_PROVIDER === "disabled")
        issue("EMAIL_PROVIDER", "must be configured when ENABLE_EMAIL_VERIFICATION=true");
    }

    if (env.EMAIL_PROVIDER === "resend") {
      if (!env.EMAIL_API_URL) issue("EMAIL_API_URL", "required when EMAIL_PROVIDER=resend");
      if (!env.EMAIL_API_KEY) issue("EMAIL_API_KEY", "required when EMAIL_PROVIDER=resend");
    }
    if (env.EMAIL_PROVIDER !== "disabled" && !env.EMAIL_FROM_ADDRESS)
      issue("EMAIL_FROM_ADDRESS", "required when an email provider is configured");

    if (env.ENABLE_SMS_VERIFICATION && env.SMS_PROVIDER === "disabled")
      issue("SMS_PROVIDER", "must be configured when ENABLE_SMS_VERIFICATION=true");

    if (env.ENABLE_PAYMENTS && env.PAYMENT_PROVIDER === "disabled")
      issue("PAYMENT_PROVIDER", "must be configured when ENABLE_PAYMENTS=true");
    if (env.PAYMENT_PROVIDER === "razorpay") {
      for (const key of [
        "PAYMENT_API_BASE_URL",
        "PAYMENT_KEY_ID",
        "PAYMENT_KEY_SECRET",
        "PAYMENT_WEBHOOK_SECRET",
        "PAYMENT_CHECKOUT_SCRIPT_URL",
      ] as const) {
        if (!env[key]) issue(key, "required when PAYMENT_PROVIDER=razorpay");
      }
    }

    if (env.STORAGE_PROVIDER === "s3")
      issue("STORAGE_PROVIDER", "'s3' adapter is not implemented yet; use 'local' (see docs/PROJECT_STATUS.md)");
    if (env.ERROR_TRACKING_PROVIDER === "console" && deployed)
      issue("ERROR_TRACKING_PROVIDER", "'console' is only allowed outside production/staging");
  });

export type Env = z.infer<typeof schema>;

/** Pure parser — used by `getEnv()` and by configuration tests. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test helper: forget the cached configuration. */
export function resetEnvCache() {
  cached = undefined;
}

export function isSecureCookie(env: Env = getEnv()): boolean {
  return env.SESSION_COOKIE_SECURE || env.APP_URL.startsWith("https://");
}
