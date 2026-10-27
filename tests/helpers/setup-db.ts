import { afterAll, beforeAll } from "vitest";
import { getDb } from "@/server/db/client";
import { resetDatabase } from "./db";

/**
 * Safety: integration tests TRUNCATE tables. Refuse to run unless the
 * database name ends with "_test" and the app environment is "test".
 */
const dbName = new URL(process.env.DATABASE_URL ?? "postgresql://x/none").pathname.slice(1);
if (!dbName.endsWith("_test") || process.env.APP_ENV !== "test") {
  throw new Error(`Refusing to run integration tests against database "${dbName}" (APP_ENV=${process.env.APP_ENV}).`);
}

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await getDb().$disconnect();
});
