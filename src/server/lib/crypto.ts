import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/server/config/env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomNumericCode(digits = 6): string {
  return Array.from({ length: digits }, () => randomInt(0, 10)).join("");
}

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256(secret: string, input: string | Buffer): string {
  return createHmac("sha256", secret).update(input).digest("hex");
}

/** Keyed hash for one-time tokens/OTPs so a DB leak cannot replay them. */
export function hashToken(token: string): string {
  return hmacSha256(getEnv().AUTH_SECRET, token);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
