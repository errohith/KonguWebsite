import "server-only";
import { z } from "zod";
import { formatPublicId } from "@/lib/options";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { audit } from "@/server/lib/audit";
import { AppError } from "@/server/lib/errors";
import { notify } from "@/server/modules/notifications/service";

const noteSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) => v || null);

// --- Member side: verification requests -------------------------------------

export async function requestVerification(userId: string, documentId: string, rawNote?: string) {
  if (!getEnv().ENABLE_PROFILE_VERIFICATION) throw new AppError("FEATURE_DISABLED");
  const note = noteSchema.parse(rawNote);
  const profile = await db.profile.findUnique({ where: { userId }, select: { id: true, verificationState: true } });
  if (!profile) throw new AppError("VALIDATION", "errors.completeBasicFirst");
  if (profile.verificationState === "VERIFIED") throw new AppError("CONFLICT", "errors.alreadyVerified");
  const doc = await db.document.findFirst({ where: { id: documentId, profileId: profile.id } });
  if (!doc) throw new AppError("NOT_FOUND");
  const pending = await db.verificationRequest.findFirst({ where: { profileId: profile.id, status: "PENDING" } });
  if (pending) throw new AppError("CONFLICT", "errors.verificationPending");
  await db.$transaction([
    db.verificationRequest.create({ data: { profileId: profile.id, documentId: doc.id, note } }),
    db.profile.update({ where: { id: profile.id }, data: { verificationState: "PENDING" } }),
  ]);
}

export async function listOwnVerificationRequests(userId: string) {
  return db.verificationRequest.findMany({
    where: { profile: { userId } },
    orderBy: { createdAt: "desc" },
    include: { document: { select: { id: true, type: true } } },
  });
}

// --- Staff side --------------------------------------------------------------

export async function moderationQueues() {
  const [profiles, photos, verifications, reports] = await Promise.all([
    db.profile.count({ where: { status: "PENDING_REVIEW" } }),
    db.photo.count({ where: { moderationStatus: "PENDING" } }),
    db.verificationRequest.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
  ]);
  return { profiles, photos, verifications, reports };
}

export async function listPendingProfiles() {
  const rows = await db.profile.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { updatedAt: "asc" },
    take: 50,
    include: { user: { select: { email: true } }, photos: { select: { id: true, moderationStatus: true } } },
  });
  return rows.map((p) => ({ ...p, publicId: formatPublicId(p.profileNumber) }));
}

export async function reviewProfile(actorUserId: string, profileId: string, approve: boolean, rawNote?: string) {
  const note = noteSchema.parse(rawNote);
  if (!approve && !note) throw new AppError("VALIDATION", "errors.noteRequired");
  await db.$transaction(async (tx) => {
    const { count } = await tx.profile.updateMany({
      where: { id: profileId, status: "PENDING_REVIEW" },
      data: approve
        ? { status: "PUBLISHED", publishedAt: new Date(), moderationNote: null }
        : { status: "REJECTED", moderationNote: note },
    });
    if (count !== 1) throw new AppError("CONFLICT", "errors.alreadyReviewed");
    const profile = await tx.profile.findUniqueOrThrow({ where: { id: profileId }, select: { userId: true } });
    await notify(
      {
        userId: profile.userId,
        type: approve ? "PROFILE_APPROVED" : "PROFILE_REJECTED",
        title: approve ? "Your profile is now live" : "Your profile needs changes",
        body: note ?? undefined,
        link: approve ? "/dashboard" : "/profile/edit/basic",
      },
      tx,
    );
    await audit(
      {
        actorUserId,
        action: approve ? "profile.approve" : "profile.reject",
        entityType: "Profile",
        entityId: profileId,
        metadata: { note },
      },
      tx,
    );
  });
}

/** Rejected profiles can be resubmitted by the member after editing. */
export async function setProfileSuspended(actorUserId: string, profileId: string, suspend: boolean, rawNote?: string) {
  const note = noteSchema.parse(rawNote);
  await db.$transaction(async (tx) => {
    await tx.profile.update({
      where: { id: profileId },
      data: suspend ? { status: "SUSPENDED", moderationNote: note } : { status: "PUBLISHED", moderationNote: null },
    });
    await audit(
      {
        actorUserId,
        action: suspend ? "profile.suspend" : "profile.unsuspend",
        entityType: "Profile",
        entityId: profileId,
        metadata: { note },
      },
      tx,
    );
  });
}

export async function listPendingPhotos() {
  const rows = await db.photo.findMany({
    where: { moderationStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 60,
    include: { profile: { select: { profileNumber: true, displayName: true } } },
  });
  return rows.map((p) => ({ ...p, publicId: formatPublicId(p.profile.profileNumber) }));
}

export async function reviewPhoto(actorUserId: string, photoId: string, approve: boolean, rawNote?: string) {
  const note = noteSchema.parse(rawNote);
  await db.$transaction(async (tx) => {
    const photo = await tx.photo.update({
      where: { id: photoId },
      data: { moderationStatus: approve ? "APPROVED" : "REJECTED", moderationNote: note },
      include: { profile: { select: { userId: true } } },
    });
    if (!approve) {
      await notify(
        {
          userId: photo.profile.userId,
          type: "PHOTO_REJECTED",
          title: "A photo was not approved",
          body: note ?? undefined,
          link: "/profile/edit/photos",
        },
        tx,
      );
    }
    await audit(
      {
        actorUserId,
        action: approve ? "photo.approve" : "photo.reject",
        entityType: "Photo",
        entityId: photoId,
        metadata: { note },
      },
      tx,
    );
  });
}

export async function listPendingVerifications() {
  const rows = await db.verificationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      profile: { select: { id: true, profileNumber: true, displayName: true, dateOfBirth: true } },
      document: { select: { id: true, type: true, mimeType: true } },
    },
  });
  return rows.map((r) => ({ ...r, publicId: formatPublicId(r.profile.profileNumber) }));
}

export async function reviewVerification(actorUserId: string, requestId: string, approve: boolean, rawNote?: string) {
  const note = noteSchema.parse(rawNote);
  await db.$transaction(async (tx) => {
    const { count } = await tx.verificationRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        reviewerId: actorUserId,
        reviewNote: note,
        reviewedAt: new Date(),
      },
    });
    if (count !== 1) throw new AppError("CONFLICT", "errors.alreadyReviewed");
    const req = await tx.verificationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { profile: { select: { id: true, userId: true } } },
    });
    await tx.profile.update({
      where: { id: req.profileId },
      data: { verificationState: approve ? "VERIFIED" : "REJECTED" },
    });
    await notify(
      {
        userId: req.profile.userId,
        type: approve ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
        title: approve ? "Your profile is verified" : "Verification was not approved",
        body: note ?? undefined,
        link: "/verification",
      },
      tx,
    );
    await audit(
      {
        actorUserId,
        action: approve ? "verification.approve" : "verification.reject",
        entityType: "VerificationRequest",
        entityId: requestId,
        metadata: { note },
      },
      tx,
    );
  });
}

export async function listReports(status: "open" | "closed" = "open") {
  const rows = await db.report.findMany({
    where: { status: status === "open" ? { in: ["OPEN", "UNDER_REVIEW"] } : { in: ["RESOLVED", "DISMISSED"] } },
    orderBy: { createdAt: status === "open" ? "asc" : "desc" },
    take: 100,
    include: {
      reportedProfile: { select: { id: true, profileNumber: true, displayName: true, status: true } },
      reporter: { select: { email: true } },
    },
  });
  return rows.map((r) => ({ ...r, publicId: formatPublicId(r.reportedProfile.profileNumber) }));
}

export async function resolveReport(
  actorUserId: string,
  reportId: string,
  outcome: "RESOLVED" | "DISMISSED",
  rawNote?: string,
  suspendProfile = false,
) {
  const note = noteSchema.parse(rawNote);
  await db.$transaction(async (tx) => {
    const report = await tx.report.update({
      where: { id: reportId },
      data: { status: outcome, handledById: actorUserId, resolutionNote: note, resolvedAt: new Date() },
    });
    if (suspendProfile && outcome === "RESOLVED") {
      await tx.profile.update({
        where: { id: report.reportedProfileId },
        data: { status: "SUSPENDED", moderationNote: note },
      });
    }
    await audit(
      {
        actorUserId,
        action: `report.${outcome.toLowerCase()}`,
        entityType: "Report",
        entityId: reportId,
        metadata: { note, suspendProfile },
      },
      tx,
    );
  });
}
