import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/server/config/env";

export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

/** Keys are generated server-side: "<area>/<uuid>.<ext>". Anything else is rejected. */
const KEY_PATTERN = /^[a-z-]+\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

export function assertValidKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
}

/**
 * Stores files on the local filesystem, outside `public/`, so every read
 * goes through an authorised route handler. Suitable for development and
 * single-server deployments with a persistent volume.
 */
class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    assertValidKey(key);
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data, { flag: "wx" });
  }
  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

export function getStorageProvider(): StorageProvider {
  const env = getEnv();
  // env validation rejects "s3" until that adapter exists.
  // path.resolve() is relative to the working directory (no explicit cwd: avoids
  // the bundler tracing the whole project into the server output).
  return new LocalStorageProvider(path.resolve(env.STORAGE_LOCAL_DIR));
}
