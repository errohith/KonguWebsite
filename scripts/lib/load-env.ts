import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

/**
 * Loads environment variables for CLI scripts (Prisma, seed, maintenance jobs).
 * Next.js loads `.env*` files itself; this is only for code run outside Next.
 *
 * ENV_FILE selects the file (default `.env`). Variables already present in the
 * process environment win, so hosting-provider secrets are never overridden.
 */
export function loadEnvFile(): string | null {
  const file = process.env.ENV_FILE ?? ".env";
  const resolved = path.resolve(process.cwd(), file);
  if (!existsSync(resolved)) return null;
  config({ path: resolved, quiet: true, override: false });
  return resolved;
}
