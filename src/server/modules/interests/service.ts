import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { formatPublicId } from "@/lib/options";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { startOfUtcDay } from "@/server/lib/dates";
import { AppError } from "@/server/lib/errors";
import { cardsForProfileIds } from "@/server/modules/discovery/service";
import { getEntitlements } from "@/server/modules/membership/entitlements";
import { emailBestEffort, notify } from "@/server/modules/notifications/service";
import { decideAccessFor, findProfileByPublicId } from "@/server/modules/profiles/service";

type Viewer = { id: string; gender: "MALE" | "FEMALE" };

const messageSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null);

async function requirePublishedOwnProfile(userId: string) {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { id: true, status: true, profileNumber: true },
  });
  if (!profile || profile.status !== "PUBLISHED") throw new AppError("FORBIDDEN", "errors.publishProfileFirst");
  return profile;
}

/**
 * Sends an interest. Enforces: published sender profile, target visibility,
 * no blocks, no duplicate in either direction, and the plan's daily quota.
 * A per-sender advisory lock makes the quota check race-free.
 */
export async function sendInterest(viewer: Viewer, targetPublicId: string, rawMessage?: string) {
  const message = messageSchema.parse(rawMessage);
  const sender = await requirePublishedOwnProfile(viewer.id);
  const target = await findProfileByPublicId(targetPublicId);
  if (!target || target.id === sender.id) throw new AppError("NOT_FOUND");

  const access = await decideAccessFor(viewer, target);
  if (!access.canView) throw new AppError("NOT_FOUND");

  const interest = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"interest:" + sender.id}))`;

    const reverse = await tx.interest.findUnique({
      where: { senderProfileId_receiverProfileId: { senderProfileId: target.id, receiverProfileId: sender.id } },
    });
    if (reverse && reverse.status !== "WITHDRAWN") throw new AppError("CONFLICT", "errors.interestReverseExists");

    const existing = await tx.interest.findUnique({
      where: { senderProfileId_receiverProfileId: { senderProfileId: sender.id, receiverProfileId: target.id } },
    });
    if (existing && existing.status !== "WITHDRAWN") throw new AppError("CONFLICT", "errors.interestAlreadySent");

    const ent = await getEntitlements(viewer.id, tx);
    const sentToday = await tx.interest.count({
      where: { senderProfileId: sender.id, createdAt: { gte: startOfUtcDay() } },
    });
    if (sentToday >= ent.interestsPerDay) {
      throw new AppError("ENTITLEMENT_REQUIRED", "errors.interestQuotaReached", { limit: ent.interestsPerDay });
    }

    try {
      const saved = existing
        ? await tx.interest.update({
            where: { id: existing.id },
            data: { status: "PENDING", message, respondedAt: null, createdAt: new Date() },
          })
        : await tx.interest.create({ data: { senderProfileId: sender.id, receiverProfileId: target.id, message } });
      await notify(
        {
          userId: target.userId,
          type: "INTEREST_RECEIVED",
          title: `New interest from ${formatPublicId(sender.profileNumber)}`,
          link: "/interests?tab=received",
        },
        tx,
      );
      return saved;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError("CONFLICT", "errors.interestAlreadySent");
      }
      throw err;
    }
  });

  const recipient = await db.user.findUnique({ where: { id: target.userId }, select: { email: true, locale: true } });
  if (recipient) {
    await emailBestEffort(recipient.email, recipient.locale, "interestReceived", {
      profileId: formatPublicId(sender.profileNumber),
      url: `${getEnv().APP_URL}/interests?tab=received`,
    });
  }
  return interest;
}

export async function respondToInterest(viewer: Viewer, interestId: string, accept: boolean) {
  const own = await requirePublishedOwnProfile(viewer.id);
  const updated = await db.$transaction(async (tx) => {
    const { count } = await tx.interest.updateMany({
      where: { id: interestId, receiverProfileId: own.id, status: "PENDING" },
      data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
    });
    if (count !== 1) throw new AppError("NOT_FOUND");
    const interest = await tx.interest.findUniqueOrThrow({
      where: { id: interestId },
      include: { sender: { select: { userId: true } } },
    });
    await notify(
      {
        userId: interest.sender.userId,
        type: accept ? "INTEREST_ACCEPTED" : "INTEREST_DECLINED",
        title: accept
          ? `${formatPublicId(own.profileNumber)} accepted your interest`
          : `${formatPublicId(own.profileNumber)} declined your interest`,
        link: accept ? `/profiles/${formatPublicId(own.profileNumber)}` : "/interests?tab=sent",
      },
      tx,
    );
    return interest;
  });
  if (accept) {
    const sender = await db.user.findUnique({
      where: { id: updated.sender.userId },
      select: { email: true, locale: true },
    });
    if (sender) {
      await emailBestEffort(sender.email, sender.locale, "interestAccepted", {
        profileId: formatPublicId(own.profileNumber),
        url: `${getEnv().APP_URL}/profiles/${formatPublicId(own.profileNumber)}`,
      });
    }
  }
  return updated;
}

export async function withdrawInterest(viewer: Viewer, interestId: string) {
  const own = await db.profile.findUnique({ where: { userId: viewer.id }, select: { id: true } });
  if (!own) throw new AppError("NOT_FOUND");
  const { count } = await db.interest.updateMany({
    where: { id: interestId, senderProfileId: own.id, status: "PENDING" },
    data: { status: "WITHDRAWN" },
  });
  if (count !== 1) throw new AppError("NOT_FOUND");
}

export async function listInterests(viewer: Viewer, direction: "received" | "sent") {
  const own = await db.profile.findUnique({ where: { userId: viewer.id }, select: { id: true } });
  if (!own) return [];
  const interests = await db.interest.findMany({
    where:
      direction === "received"
        ? { receiverProfileId: own.id, status: { not: "WITHDRAWN" } }
        : { senderProfileId: own.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sender: { select: { id: true, profileNumber: true } },
      receiver: { select: { id: true, profileNumber: true } },
    },
  });
  const otherIds = interests.map((i) => (direction === "received" ? i.sender.id : i.receiver.id));
  const cards = await cardsForProfileIds(viewer, otherIds);
  return interests.map((i) => {
    const other = direction === "received" ? i.sender : i.receiver;
    return {
      id: i.id,
      status: i.status,
      message: i.message,
      createdAt: i.createdAt,
      respondedAt: i.respondedAt,
      otherPublicId: formatPublicId(other.profileNumber),
      card: cards.get(other.id) ?? null,
    };
  });
}

export async function interestStatusWith(viewerUserId: string, targetProfileId: string) {
  const own = await db.profile.findUnique({ where: { userId: viewerUserId }, select: { id: true } });
  if (!own) return null;
  const interest = await db.interest.findFirst({
    where: {
      status: { not: "WITHDRAWN" },
      OR: [
        { senderProfileId: own.id, receiverProfileId: targetProfileId },
        { senderProfileId: targetProfileId, receiverProfileId: own.id },
      ],
    },
  });
  if (!interest) return null;
  return {
    id: interest.id,
    status: interest.status,
    direction: interest.senderProfileId === own.id ? "sent" : "received",
  } as const;
}

// --- Shortlists -------------------------------------------------------------

export async function addToShortlist(viewer: Viewer, targetPublicId: string) {
  const target = await findProfileByPublicId(targetPublicId);
  if (!target) throw new AppError("NOT_FOUND");
  const access = await decideAccessFor(viewer, target);
  if (!access.canView || access.isOwner) throw new AppError("NOT_FOUND");
  await db.shortlist.upsert({
    where: { userId_targetProfileId: { userId: viewer.id, targetProfileId: target.id } },
    create: { userId: viewer.id, targetProfileId: target.id },
    update: {},
  });
}

export async function removeFromShortlist(viewer: Viewer, targetPublicId: string) {
  const target = await findProfileByPublicId(targetPublicId);
  if (!target) return;
  await db.shortlist.deleteMany({ where: { userId: viewer.id, targetProfileId: target.id } });
}

export async function listShortlist(viewer: Viewer) {
  const rows = await db.shortlist.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    select: { targetProfileId: true },
  });
  const cards = await cardsForProfileIds(
    viewer,
    rows.map((r) => r.targetProfileId),
  );
  // Profiles that became hidden/blocked drop out silently.
  return rows.map((r) => cards.get(r.targetProfileId)).filter((c) => c !== undefined);
}
