import "server-only";
import type { User } from "@/generated/prisma/client";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { addDays, DAY_MS } from "@/server/lib/dates";
import { randomToken, sha256 } from "@/server/lib/crypto";

/** Statuses that may hold a session. Deactivated / deletion-requested users
 *  can sign in to reactivate or cancel deletion; suspended/deleted cannot. */
export const SESSION_STATUSES = new Set<User["status"]>([
  "ACTIVE",
  "PENDING_VERIFICATION",
  "DEACTIVATED",
  "DELETION_REQUESTED",
]);

export type SessionUser = Pick<
  User,
  "id" | "email" | "role" | "status" | "gender" | "locale" | "emailVerifiedAt" | "phoneVerifiedAt"
>;

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomToken(32);
  const expiresAt = addDays(new Date(), getEnv().SESSION_TTL_DAYS);
  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt, userAgent: userAgent?.slice(0, 300) },
  });
  return { token, expiresAt };
}

/** Returns the user for a valid token, extending the session (sliding expiry) at most daily. */
export async function validateSessionToken(token: string | undefined | null) {
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          gender: true,
          locale: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
        },
      },
    },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !SESSION_STATUSES.has(session.user.status)) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastUsedAt.getTime() > DAY_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(), expiresAt: addDays(new Date(), getEnv().SESSION_TTL_DAYS) },
    });
  }
  return { sessionId: session.id, user: session.user as SessionUser };
}

export async function revokeSessionToken(token: string) {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function revokeAllSessions(userId: string, exceptTokenHash?: string) {
  await db.session.deleteMany({
    where: { userId, ...(exceptTokenHash ? { NOT: { tokenHash: exceptTokenHash } } : {}) },
  });
}
