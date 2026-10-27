import { execSync } from "node:child_process";
import path from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

/** Resets the TEST database and seeds reference + synthetic data. */
export default async function globalSetup() {
  const env = config({ path: path.resolve(__dirname, "../../.env.test"), quiet: true, processEnv: {} }).parsed ?? {};
  const url = env.DATABASE_URL ?? "";
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("E2E must run against a *_test database");
  const client = new Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'",
  );
  await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await client.query(`ALTER SEQUENCE "Profile_profileNumber_seq" RESTART WITH 100001`);
  await client.end();
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, ...env, ENV_FILE: ".env.test" } });
}
