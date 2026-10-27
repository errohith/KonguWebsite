import "server-only";
import { z } from "zod";
import { formatPublicId } from "@/lib/options";
import { REPORT_REASONS } from "@/lib/options";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { getStorageProvider } from "@/server/integrations/storage";
import { audit } from "@/server/lib/audit";
import { randomToken } from "@/server/lib/crypto";
import { addDays } from "@/server/lib/dates";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/server/modules/auth/password";
import { revokeAllSessions } from "@/server/modules/auth/sessions";
import { findProfileByPublicId } from "@/server/modules/profiles/service";

// --- Blocks -----------------------------------------------------------------

export async function blockProfile(userId: string, targetPublicId: string) {
  const target = await findProfileByPublicId(targetPublicId);
  if (!target || target.userId === userId) throw new AppError("NOT_FOUND");
  await db.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerUserId_blockedUserId: { blockerUserId: userId, blockedUserId: target.userId } },
      create: { blockerUserId: userId, blockedUserId: target.userId },
      update: {},
    });
    // Pending interests between the two are closed; shortlist entry removed.
    const own = await tx.profile.findUnique({ where: { userId }, select: { id: true } });
    if (own) {
      await tx.interest.updateMany({
        where: {
          status: "PENDING",
          OR: [
            { senderProfileId: own.id, receiverProfileId: target.id },
            { senderProfileId: target.id, receiverProfileId: own.id },
          ],
        },
        data: { status: "WITHDRAWN" },
      });
    }
    await tx.shortlist.deleteMany({ where: { userId, targetProfileId: target.id } });
  });
}

export async function unblock(userId: string, blockId: string) {
  await db.block.deleteMany({ where: { id: blockId, blockerUserId: userId } });
}

export async function listBlocked(userId: string) {
  const blocks = await db.block.findMany({
    where: { blockerUserId: userId },
    orderBy: { createdAt: "desc" },
    include: { blocked: { select: { profile: { select: { profileNumber: true, displayName: true } } } } },
  });
  return blocks.map((b) => ({
    id: b.id,
    createdAt: b.createdAt,
    publicId: b.blocked.profile ? formatPublicId(b.blocked.profile.profileNumber) : null,
    displayName: b.blocked.profile?.displayName ?? null,
  }));
}

// --- Reports ----------------------------------------------------------------

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
});

export async function reportProfile(userId: string, targetPublicId: string, raw: unknown) {
  const input = reportSchema.parse(raw);
  await enforceRateLimit(`report:${userId}`, 10, 86_400);
  const target = await findProfileByPublicId(targetPublicId);
  if (!target || target.userId === userId) throw new AppError("NOT_FOUND");
  const open = await db.report.findFirst({
    where: { reporterUserId: userId, reportedProfileId: target.id, status: { in: ["OPEN", "UNDER_REVIEW"] } },
  });
  if (open) throw new AppError("CONFLICT", "errors.reportAlreadyOpen");
  return db.report.create({
    data: { reporterUserId: userId, reportedProfileId: target.id, reason: input.reason, details: input.details },
  });
}

// --- Account lifecycle ------------------------------------------------------

async function confirmPassword(userId: string, password: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, password))) throw new AppError("INVALID_CREDENTIALS");
}

export async function deactivateAccount(userId: string, password: string) {
  await confirmPassword(userId, password);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status: "DEACTIVATED", deactivatedAt: new Date() } }),
    db.profile.updateMany({ where: { userId, status: "PUBLISHED" }, data: { status: "HIDDEN" } }),
  ]);
}

export async function reactivateAccount(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.status !== "DEACTIVATED" && user.status !== "DELETION_REQUESTED") return;
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        status: user.emailVerifiedAt ? "ACTIVE" : "PENDING_VERIFICATION",
        deactivatedAt: null,
        deletionRequestedAt: null,
        deletionScheduledAt: null,
      },
    }),
    db.profile.updateMany({ where: { userId, status: "HIDDEN" }, data: { status: "PUBLISHED" } }),
  ]);
}

/** Starts the deletion grace period. The account is hidden immediately. */
export async function requestAccountDeletion(userId: string, password: string, keepSessionTokenHash?: string) {
  await confirmPassword(userId, password);
  const now = new Date();
  const scheduled = addDays(now, getEnv().ACCOUNT_DELETION_GRACE_DAYS);
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { status: "DELETION_REQUESTED", deletionRequestedAt: now, deletionScheduledAt: scheduled },
    }),
    db.profile.updateMany({ where: { userId, status: "PUBLISHED" }, data: { status: "HIDDEN" } }),
  ]);
  await revokeAllSessions(userId, keepSessionTokenHash);
  return { scheduledFor: scheduled };
}

/**
 * Permanently erases personal data for one user. Financial records
 * (payments, refunds, subscriptions) are retained for statutory accounting
 * but are linked only to the anonymised user row.
 */
export async function eraseUser(userId: string, actorUserId: string | null = null) {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { id: true, photos: { select: { storageKey: true } }, documents: { select: { storageKey: true } } },
  });
  const storageKeys = [...(profile?.photos ?? []), ...(profile?.documents ?? [])].map((f) => f.storageKey);

  await db.$transaction(async (tx) => {
    if (profile) await tx.profile.delete({ where: { id: profile.id } }); // cascades contact, photos, interests…
    await tx.session.deleteMany({ where: { userId } });
    await tx.verificationToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.shortlist.deleteMany({ where: { userId } });
    await tx.block.deleteMany({ where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] } });
    await tx.contactView.deleteMany({ where: { viewerUserId: userId } });
    await tx.supportTicket.updateMany({
      where: { requesterId: userId },
      data: { name: "Deleted member", email: "deleted@deleted.invalid" },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${userId}@deleted.invalid`,
        phone: null,
        passwordHash: await hashPassword(randomToken(32)),
        dateOfBirth: new Date("1900-01-01T00:00:00Z"),
        status: "DELETED",
        deletedAt: new Date(),
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      },
    });
    await audit({ actorUserId, action: "user.erase", entityType: "User", entityId: userId }, tx);
  });

  const storage = getStorageProvider();
  for (const key of storageKeys) {
    await storage.delete(key).catch((err) => logger.error("privacy.file_delete_failed", { key, error: err }));
  }
}

/** Maintenance job: erase every account whose grace period has ended. */
export async function processDueDeletions(now = new Date()) {
  const due = await db.user.findMany({
    where: { status: "DELETION_REQUESTED", deletionScheduledAt: { lte: now } },
    select: { id: true },
  });
  for (const { id } of due) await eraseUser(id);
  return due.length;
}

// --- Data export ------------------------------------------------------------

/** Everything we hold about a member, in a portable JSON structure. */
export async function exportUserData(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      dateOfBirth: true,
      gender: true,
      locale: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      termsAcceptedAt: true,
      lastLoginAt: true,
      createdAt: true,
      profile: {
        include: {
          contact: true,
          horoscope: true,
          preference: true,
          photos: {
            select: {
              id: true,
              mimeType: true,
              sizeBytes: true,
              isPrimary: true,
              moderationStatus: true,
              createdAt: true,
            },
          },
          documents: { select: { id: true, type: true, mimeType: true, sizeBytes: true, createdAt: true } },
          verificationRequests: {
            select: { status: true, note: true, reviewNote: true, createdAt: true, reviewedAt: true },
          },
          interestsSent: {
            select: { status: true, message: true, createdAt: true, receiver: { select: { profileNumber: true } } },
          },
          interestsReceived: {
            select: { status: true, message: true, createdAt: true, sender: { select: { profileNumber: true } } },
          },
        },
      },
      shortlists: { select: { createdAt: true, targetProfile: { select: { profileNumber: true } } } },
      blocksMade: {
        select: { createdAt: true, blocked: { select: { profile: { select: { profileNumber: true } } } } },
      },
      reportsMade: { select: { reason: true, details: true, status: true, createdAt: true } },
      subscriptions: {
        select: { status: true, startsAt: true, endsAt: true, plan: { select: { code: true, name: true } } },
      },
      payments: {
        select: { amount: true, currency: true, status: true, provider: true, createdAt: true, capturedAt: true },
      },
      notifications: { select: { type: true, title: true, createdAt: true, readAt: true } },
      supportTickets: {
        select: {
          subject: true,
          status: true,
          createdAt: true,
          messages: { select: { body: true, isStaff: true, createdAt: true } },
        },
      },
    },
  });
  return { exportedAt: new Date().toISOString(), format: "kongu-matrimony-export/v1", data: user };
}
