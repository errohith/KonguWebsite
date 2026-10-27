import "server-only";
import { randomUUID } from "node:crypto";
import type { DocumentType } from "@/generated/prisma/enums";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { getStorageProvider } from "@/server/integrations/storage";
import { AppError } from "@/server/lib/errors";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { hasPermission } from "@/server/modules/auth/permissions";
import type { SessionUser } from "@/server/modules/auth/sessions";
import { decideAccessFor, recomputeCompleteness } from "@/server/modules/profiles/service";

type Detected = { mime: string; ext: "jpg" | "png" | "webp" | "pdf" };

/** Identifies the file by its magic bytes; the client-declared type is ignored. */
export function sniffFileType(buf: Buffer): Detected | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: "png" };
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

async function readUpload(file: File, allowPdf: boolean): Promise<{ data: Buffer; type: Detected }> {
  const max = getEnv().MAX_UPLOAD_BYTES;
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0)
    throw new AppError("VALIDATION", "errors.fileRequired");
  if (file.size > max) throw new AppError("VALIDATION", "errors.fileTooLarge", { maxBytes: max });
  const data = Buffer.from(await file.arrayBuffer());
  const type = sniffFileType(data);
  if (!type || (type.ext === "pdf" && !allowPdf)) throw new AppError("VALIDATION", "errors.fileTypeNotAllowed");
  return { data, type };
}

async function ownProfile(userId: string) {
  const profile = await db.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new AppError("VALIDATION", "errors.completeBasicFirst");
  return profile;
}

export async function uploadPhoto(userId: string, file: File) {
  await enforceRateLimit(`upload:${userId}`, 30, 3600);
  const profile = await ownProfile(userId);
  const { data, type } = await readUpload(file, false);
  const env = getEnv();
  const count = await db.photo.count({ where: { profileId: profile.id } });
  if (count >= env.MAX_PHOTOS_PER_PROFILE)
    throw new AppError("VALIDATION", "errors.tooManyPhotos", { max: env.MAX_PHOTOS_PER_PROFILE });

  const key = `photos/${randomUUID()}.${type.ext}`;
  await getStorageProvider().put(key, data, type.mime);
  try {
    const photo = await db.photo.create({
      data: {
        profileId: profile.id,
        storageKey: key,
        mimeType: type.mime,
        sizeBytes: data.length,
        isPrimary: count === 0,
        sortOrder: count,
        moderationStatus: env.ENABLE_PROFILE_MODERATION ? "PENDING" : "APPROVED",
      },
    });
    await recomputeCompleteness(profile.id);
    return photo;
  } catch (err) {
    await getStorageProvider().delete(key);
    throw err;
  }
}

export async function deletePhoto(userId: string, photoId: string) {
  const profile = await ownProfile(userId);
  const photo = await db.photo.findFirst({ where: { id: photoId, profileId: profile.id } });
  if (!photo) throw new AppError("NOT_FOUND");
  await db.$transaction(async (tx) => {
    await tx.photo.delete({ where: { id: photo.id } });
    if (photo.isPrimary) {
      const next = await tx.photo.findFirst({ where: { profileId: profile.id }, orderBy: { sortOrder: "asc" } });
      if (next) await tx.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });
  await getStorageProvider().delete(photo.storageKey);
  await recomputeCompleteness(profile.id);
}

export async function setPrimaryPhoto(userId: string, photoId: string) {
  const profile = await ownProfile(userId);
  await db.$transaction(async (tx) => {
    const photo = await tx.photo.findFirst({ where: { id: photoId, profileId: profile.id } });
    if (!photo) throw new AppError("NOT_FOUND");
    await tx.photo.updateMany({ where: { profileId: profile.id, isPrimary: true }, data: { isPrimary: false } });
    await tx.photo.update({ where: { id: photo.id }, data: { isPrimary: true } });
  });
}

/**
 * Returns photo bytes only if the viewer may see them: the owner, staff
 * with moderation rights, or a member allowed by the profile's photo rules.
 */
export async function readPhotoForViewer(viewer: SessionUser | null, photoId: string) {
  if (!viewer) throw new AppError("UNAUTHENTICATED");
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    include: { profile: { include: { user: { select: { status: true } } } } },
  });
  if (!photo) throw new AppError("NOT_FOUND");
  const isStaff = hasPermission(viewer.role, "moderation.manage");
  if (!isStaff) {
    const access = await decideAccessFor(viewer, photo.profile);
    if (!access.canView || !access.canSeePhotos) throw new AppError("NOT_FOUND");
    if (!access.isOwner && photo.moderationStatus !== "APPROVED") throw new AppError("NOT_FOUND");
  }
  const data = await getStorageProvider().get(photo.storageKey);
  if (!data) throw new AppError("NOT_FOUND");
  return { data, mimeType: photo.mimeType };
}

// --- Documents (verification evidence; never shown to other members) ---------

export async function uploadDocument(userId: string, type: DocumentType, file: File) {
  await enforceRateLimit(`upload:${userId}`, 30, 3600);
  const profile = await ownProfile(userId);
  const { data, type: detected } = await readUpload(file, true);
  const key = `documents/${randomUUID()}.${detected.ext}`;
  await getStorageProvider().put(key, data, detected.mime);
  try {
    return await db.document.create({
      data: { profileId: profile.id, type, storageKey: key, mimeType: detected.mime, sizeBytes: data.length },
    });
  } catch (err) {
    await getStorageProvider().delete(key);
    throw err;
  }
}

export async function readDocument(viewer: SessionUser | null, documentId: string) {
  if (!viewer) throw new AppError("UNAUTHENTICATED");
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { profile: { select: { userId: true } } },
  });
  if (!doc) throw new AppError("NOT_FOUND");
  if (doc.profile.userId !== viewer.id && !hasPermission(viewer.role, "moderation.manage"))
    throw new AppError("NOT_FOUND");
  const data = await getStorageProvider().get(doc.storageKey);
  if (!data) throw new AppError("NOT_FOUND");
  return { data, mimeType: doc.mimeType };
}

export async function deleteDocument(userId: string, documentId: string) {
  const profile = await ownProfile(userId);
  const doc = await db.document.findFirst({ where: { id: documentId, profileId: profile.id } });
  if (!doc) throw new AppError("NOT_FOUND");
  await db.document.delete({ where: { id: doc.id } });
  await getStorageProvider().delete(doc.storageKey);
}
