import { describe, expect, it } from "vitest";
import { ConfigError, parseEnv } from "@/server/config/env";

const base = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  AUTH_SECRET: "x".repeat(40),
};

const issues = (src: Record<string, string | undefined>) => {
  try {
    parseEnv(src);
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return (err as ConfigError).issues;
  }
};

describe("environment configuration", () => {
  it("accepts a minimal development configuration with safe defaults", () => {
    const env = parseEnv(base);
    expect(env.APP_ENV).toBe("development");
    expect(env.ENABLE_PAYMENTS).toBe(false);
    expect(env.PAYMENT_PROVIDER).toBe("disabled");
    expect(env.MIN_AGE_MALE).toBe(21);
    expect(env.MIN_AGE_FEMALE).toBe(18);
  });

  it("reports every missing required variable by name", () => {
    const list = issues({});
    expect(list.some((i) => i.startsWith("APP_URL"))).toBe(true);
    expect(list.some((i) => i.startsWith("DATABASE_URL"))).toBe(true);
    expect(list.some((i) => i.startsWith("AUTH_SECRET"))).toBe(true);
  });

  it("rejects an invalid database URL and a short secret", () => {
    const list = issues({ ...base, DATABASE_URL: "mysql://x", AUTH_SECRET: "short" });
    expect(list.join("\n")).toMatch(/DATABASE_URL: must be a postgresql/);
    expect(list.join("\n")).toMatch(/AUTH_SECRET: must be at least 32/);
  });

  it("never includes secret values in error messages", () => {
    const secret = "super-secret-database-password-value";
    try {
      parseEnv({ ...base, DATABASE_URL: `mysql://root:${secret}@db/x`, AUTH_SECRET: "tooshort" });
    } catch (err) {
      expect(String((err as Error).message)).not.toContain(secret);
      expect(String((err as Error).message)).not.toContain("tooshort");
    }
  });

  it("enforces production safety rules", () => {
    const list = issues({
      ...base,
      APP_ENV: "production",
      EMAIL_PROVIDER: "console",
      AUTH_SECRET: "REPLACE_WITH_" + "x".repeat(40),
    });
    const text = list.join("\n");
    expect(text).toMatch(/APP_URL: must use https/);
    expect(text).toMatch(/SESSION_COOKIE_SECURE/);
    expect(text).toMatch(/EMAIL_PROVIDER: 'console'/);
    expect(text).toMatch(/AUTH_SECRET: still contains a placeholder/);
  });

  it("requires provider credentials when payments are enabled", () => {
    expect(issues({ ...base, ENABLE_PAYMENTS: "true" }).join()).toMatch(/PAYMENT_PROVIDER/);
    const text = issues({ ...base, ENABLE_PAYMENTS: "true", PAYMENT_PROVIDER: "razorpay" }).join("\n");
    for (const key of ["PAYMENT_API_BASE_URL", "PAYMENT_KEY_ID", "PAYMENT_KEY_SECRET", "PAYMENT_WEBHOOK_SECRET"]) {
      expect(text).toContain(key);
    }
  });

  it("parses booleans strictly", () => {
    expect(parseEnv({ ...base, ENABLE_HOROSCOPE_FEATURE: "true" }).ENABLE_HOROSCOPE_FEATURE).toBe(true);
    expect(parseEnv({ ...base, ENABLE_HOROSCOPE_FEATURE: "false" }).ENABLE_HOROSCOPE_FEATURE).toBe(false);
    expect(issues({ ...base, ENABLE_HOROSCOPE_FEATURE: "yes" }).join()).toMatch(/ENABLE_HOROSCOPE_FEATURE/);
  });

  it("rejects the unimplemented s3 storage provider with a clear message", () => {
    expect(issues({ ...base, STORAGE_PROVIDER: "s3" }).join()).toMatch(/not implemented/);
  });
});
