import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

/**
 * Browser end-to-end tests. Runs the production build (`npm run build` first)
 * against the TEST database from .env.test — never the development database.
 */
const testEnv = config({ path: path.resolve(__dirname, ".env.test"), quiet: true, processEnv: {} }).parsed ?? {};
const baseURL = testEnv.APP_URL ?? "http://localhost:3100";
const port = new URL(baseURL).port || "3100";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Real process env wins over .env files in Next.js, so the server uses the test database.
    env: { ...testEnv, NODE_ENV: "production" },
  },
});
