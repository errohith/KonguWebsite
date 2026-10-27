import { defineConfig, env } from "prisma/config";
import { loadEnvFile } from "./scripts/lib/load-env";

// The Prisma CLI does not load .env files itself. ENV_FILE selects which file
// to load (defaults to `.env`); test scripts set ENV_FILE=.env.test.
loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
