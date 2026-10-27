import { getEnv } from "@/server/config/env";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Keys whose values are never written to logs. */
const SENSITIVE = /pass(word)?|secret|token|authorization|cookie|api[_-]?key|otp|signature|dsn|database_url/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  }
  return out;
}

function currentLevel(): Level {
  try {
    return getEnv().LOG_LEVEL;
  } catch {
    return "info";
  }
}

function write(level: Level, message: string, context?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...(context ? (redact(context) as object) : {}),
  });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => write("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => write("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => write("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => write("error", m, c),
};
