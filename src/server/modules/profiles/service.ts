import "server-only";
import type { Profile } from "@/generated/prisma/client";
import type { UserStatus } from "@/generated/prisma/enums";
import { formatPublicId, parsePublicId } from "@/lib/options";
import { getEnv } from "@/server/config/env";
import { db, type Tx } from "@/server/db/client";
import { ageOn } from "@/server/lib/dates";
import { AppError } from "@/server/lib/errors";
import { getEntitlements } from "@/server/modules/membership/entitlements";
import { decideAccess, type AccessDecision } from "./access";
import { computeCompleteness, missingForPublish } from "./completeness";
import {
  basicSchema,
  careerSchema,
  contactSchema,
  familySchema,
  horoscopeSchema,
  locationSchema,
  preferencesSchema,
  privacySchema,
  type ProfileStep,
} from "./schemas";

export async function getOwnProfile(userId: string) {
  return db.profile.findUnique({
    where: { userId },
    include: {
      contact: true,
      horoscope: true,
      preference: true,
      photos: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getOwnProfileId(userId: string) {
  const p = await db.profile.findUnique({ where: { userId }, select: { id: true } });
  return p?.id ?? null;
}

export async function recomputeCompleteness(profileId: string, tx: Tx = db) {
  const p = await tx.profile.findUniqueOrThrow({
    where: { id: profileId },
    include: {
      contact: true,
      horoscope: true,
      preference: true,
      _count: { select: { photos: { where: { moderationStatus: { not: "REJECTED" } } } } },
    },
  });
  const input = {
    ...p,
    hasContact: !!(p.contact?.contactPhone || p.contact?.contactEmail),
    hasPreferences: !!p.preference,
    approvedOrPendingPhotos: p._count.photos,
    hasHoroscope: !!(p.horoscope?.rasi || p.horoscope?.nakshatram),
    horoscopeEnabled: getEnv().ENABLE_HOROSCOPE_FEATURE,
  };
  const completeness = computeCompleteness(input);
  await tx.profile.update({ where: { id: profileId }, data: { completeness } });
  return { completeness, missing: missingForPublish(input) };
}

/** Saves one step of the multi-step profile wizard. Creates the profile on the first (basic) step. */
export async function saveProfileStep(userId: string, step: ProfileStep, raw: unknown) {
  return db.$transaction(async (tx) => {
    const existing = await tx.profile.findUnique({ where: { userId }, select: { id: true } });

    if (step === "basic") {
      const data = basicSchema.parse(raw);
      if (existing) {
        await tx.profile.update({ where: { id: existing.id }, data });
        await recomputeCompleteness(existing.id, tx);
        return existing.id;
      }
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { gender: true, dateOfBirth: true },
      });
      const created = await tx.profile.create({
        data: { ...data, userId, gender: user.gender, dateOfBirth: user.dateOfBirth },
      });
      await recomputeCompleteness(created.id, tx);
      return created.id;
    }

    if (!existing) throw new AppError("VALIDATION", "errors.completeBasicFirst");
    const profileId = existing.id;

    switch (step) {
      case "career":
        await tx.profile.update({ where: { id: profileId }, data: careerSchema.parse(raw) });
        break;
      case "location":
        await tx.profile.update({ where: { id: profileId }, data: locationSchema.parse(raw) });
        break;
      case "family":
        await tx.profile.update({ where: { id: profileId }, data: familySchema.parse(raw) });
        break;
      case "horoscope": {
        if (!getEnv().ENABLE_HOROSCOPE_FEATURE) throw new AppError("FEATURE_DISABLED");
        const data = horoscopeSchema.parse(raw);
        await tx.horoscope.upsert({ where: { profileId }, create: { profileId, ...data }, update: data });
        break;
      }
      case "contact": {
        const data = contactSchema.parse(raw);
        await tx.profileContact.upsert({ where: { profileId }, create: { profileId, ...data }, update: data });
        break;
      }
      case "preferences": {
        const data = preferencesSchema.parse(raw);
        await tx.partnerPreference.upsert({
          where: { profileId },
          create: { profileId, ...data },
          update: data,
        });
        break;
      }
      case "privacy":
        await tx.profile.update({ where: { id: profileId }, data: privacySchema.parse(raw) });
        break;
      case "photos":
        // Photos are managed through the media module.
        break;
    }
    await recomputeCompleteness(profileId, tx);
    return profileId;
  });
}

/**
 * Submits the profile. With moderation enabled it enters the review queue;
 * otherwise it is published immediately. Requires a verified, active account.
 */
export async function submitProfile(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true } });
  if (user.status === "PENDING_VERIFICATION") throw new AppError("EMAIL_NOT_VERIFIED");
  if (user.status !== "ACTIVE") throw new AppError("ACCOUNT_INACTIVE");
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) throw new AppError("VALIDATION", "errors.completeBasicFirst");
  if (profile.status === "SUSPENDED") throw new AppError("FORBIDDEN");
  if (profile.status === "PUBLISHED" || profile.status === "PENDING_REVIEW") return profile.status;

  const { missing } = await recomputeCompleteness(profile.id);
  if (missing.length) throw new AppError("VALIDATION", "errors.profileIncomplete", { missing });

  const moderated = getEnv().ENABLE_PROFILE_MODERATION;
  const updated = await db.profile.update({
    where: { id: profile.id },
    data: moderated
      ? { status: "PENDING_REVIEW", moderationNote: null }
      : { status: "PUBLISHED", publishedAt: profile.publishedAt ?? new Date() },
  });
  return updated.status;
}

export async function findProfileByPublicId(publicId: string) {
  const n = parsePublicId(publicId);
  if (n === null) return null;
  return db.profile.findUnique({
    where: { profileNumber: n },
    include: { user: { select: { status: true } } },
  });
}

export async function loadRelationship(
  viewer: { userId: string; profileId: string | null },
  target: { userId: string; profileId: string },
  tx: Tx = db,
) {
  // Sequential: these may run on an interactive transaction client, which
  // must not execute queries concurrently.
  const block = await tx.block.findFirst({
    where: {
      OR: [
        { blockerUserId: viewer.userId, blockedUserId: target.userId },
        { blockerUserId: target.userId, blockedUserId: viewer.userId },
      ],
    },
    select: { id: true },
  });
  const accepted = viewer.profileId
    ? await tx.interest.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderProfileId: viewer.profileId, receiverProfileId: target.profileId },
            { senderProfileId: target.profileId, receiverProfileId: viewer.profileId },
          ],
        },
        select: { id: true },
      })
    : null;
  const viewed = await tx.contactView.findUnique({
    where: { viewerUserId_targetProfileId: { viewerUserId: viewer.userId, targetProfileId: target.profileId } },
    select: { id: true },
  });
  return { blockedEitherWay: !!block, acceptedInterest: !!accepted, contactAlreadyViewed: !!viewed };
}

export async function decideAccessFor(
  viewer: { id: string; gender: "MALE" | "FEMALE" },
  target: Profile & { user: { status: UserStatus } },
  tx: Tx = db,
): Promise<AccessDecision> {
  const viewerProfileId = await tx.profile
    .findUnique({ where: { userId: viewer.id }, select: { id: true } })
    .then((p) => p?.id ?? null);
  const ent = await getEntitlements(viewer.id, tx);
  const rel = await loadRelationship(
    { userId: viewer.id, profileId: viewerProfileId },
    { userId: target.userId, profileId: target.id },
    tx,
  );
  return decideAccess(
    {
      userId: viewer.id,
      gender: viewer.gender,
      canViewPremiumOnly: ent.canViewPremiumOnly,
      canViewContacts: ent.canViewContacts,
      contactQuotaRemaining: ent.contactViewsUsed < ent.contactViewsIncluded,
    },
    {
      ownerUserId: target.userId,
      ownerStatus: target.user.status,
      gender: target.gender,
      status: target.status,
      visibility: target.visibility,
      photoVisibility: target.photoVisibility,
    },
    rel,
  );
}

/** Member-facing profile view. Returns only fields the viewer may see. */
export async function getProfileForViewer(viewer: { id: string; gender: "MALE" | "FEMALE" }, publicId: string) {
  const target = await findProfileByPublicId(publicId);
  if (!target) throw new AppError("NOT_FOUND");
  const access = await decideAccessFor(viewer, target);
  if (!access.canView) throw new AppError("NOT_FOUND");

  const [horoscope, preference, photos, contact] = await Promise.all([
    getEnv().ENABLE_HOROSCOPE_FEATURE ? db.horoscope.findUnique({ where: { profileId: target.id } }) : null,
    db.partnerPreference.findUnique({ where: { profileId: target.id } }),
    access.canSeePhotos
      ? db.photo.findMany({
          where: { profileId: target.id, ...(access.isOwner ? {} : { moderationStatus: "APPROVED" }) },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: { id: true, isPrimary: true },
        })
      : [],
    access.canSeeContact ? db.profileContact.findUnique({ where: { profileId: target.id } }) : null,
  ]);

  return {
    access,
    /** Internal id for server-side follow-up queries. Never serialise to clients. */
    targetProfileId: target.id,
    profile: {
      publicId: formatPublicId(target.profileNumber),
      displayName: target.displayName,
      gender: target.gender,
      age: ageOn(target.dateOfBirth),
      createdFor: target.createdFor,
      maritalStatus: target.maritalStatus,
      heightCm: target.heightCm,
      motherTongue: target.motherTongue,
      religion: target.religion,
      community: target.community,
      kootam: target.kootam,
      aboutMe: target.aboutMe,
      highestEducation: target.highestEducation,
      educationDetail: target.educationDetail,
      occupation: target.occupation,
      employmentType: target.employmentType,
      annualIncomeInr: target.annualIncomeInr?.toString() ?? null,
      nativePlace: target.nativePlace,
      nativeDistrict: target.nativeDistrict,
      currentCity: target.currentCity,
      currentState: target.currentState,
      currentCountry: target.currentCountry,
      residencyStatus: target.residencyStatus,
      fatherOccupation: target.fatherOccupation,
      motherOccupation: target.motherOccupation,
      siblingsSummary: target.siblingsSummary,
      familyType: target.familyType,
      familyStatus: target.familyStatus,
      familyDetails: target.familyDetails,
      verified: target.verificationState === "VERIFIED",
      status: access.isOwner ? target.status : undefined,
      lastActiveAt: target.lastActiveAt,
    },
    horoscope: horoscope
      ? {
          rasi: horoscope.rasi,
          nakshatram: horoscope.nakshatram,
          lagnam: horoscope.lagnam,
          dosham: horoscope.dosham,
          birthTime: horoscope.birthTime,
          birthPlace: horoscope.birthPlace,
        }
      : null,
    preference: preference
      ? {
          ageMin: preference.ageMin,
          ageMax: preference.ageMax,
          heightMinCm: preference.heightMinCm,
          heightMaxCm: preference.heightMaxCm,
          maritalStatuses: preference.maritalStatuses,
          educationLevels: preference.educationLevels,
          aboutPartner: preference.aboutPartner,
        }
      : null,
    photos,
    contact: contact
      ? {
          contactName: contact.contactName,
          contactPhone: contact.contactPhone,
          contactEmail: contact.contactEmail,
          relationship: contact.relationship,
        }
      : null,
  };
}

/**
 * Unlocks a profile's contact details. Requires an accepted interest and a
 * plan with contact access; consumes one contact view the first time.
 */
export async function revealContact(viewer: { id: string; gender: "MALE" | "FEMALE" }, publicId: string) {
  return db.$transaction(async (tx) => {
    // Serialise reveals per viewer so concurrent requests cannot exceed the quota.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"contact:" + viewer.id}))`;
    const target = await tx.profile.findUnique({
      where: { profileNumber: parsePublicId(publicId) ?? -1 },
      include: { user: { select: { status: true } } },
    });
    if (!target) throw new AppError("NOT_FOUND");
    const access = await decideAccessFor(viewer, target, tx);
    if (!access.canView) throw new AppError("NOT_FOUND");
    if (!access.isOwner) {
      if (access.contactLockedReason === "NEEDS_ACCEPTED_INTEREST")
        throw new AppError("FORBIDDEN", "errors.needsAcceptedInterest");
      if (access.contactLockedReason)
        throw new AppError("ENTITLEMENT_REQUIRED", `errors.${access.contactLockedReason}`);
      const ent = await getEntitlements(viewer.id, tx);
      await tx.contactView.upsert({
        where: { viewerUserId_targetProfileId: { viewerUserId: viewer.id, targetProfileId: target.id } },
        create: { viewerUserId: viewer.id, targetProfileId: target.id, subscriptionId: ent.subscriptionId },
        update: {},
      });
    }
    const contact = await tx.profileContact.findUnique({ where: { profileId: target.id } });
    return {
      contactName: contact?.contactName ?? null,
      contactPhone: contact?.contactPhone ?? null,
      contactEmail: contact?.contactEmail ?? null,
      relationship: contact?.relationship ?? null,
    };
  });
}

/** Updates last-active at most every 10 minutes. */
export async function touchLastActive(userId: string) {
  await db.profile.updateMany({
    where: { userId, lastActiveAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { lastActiveAt: new Date() },
  });
}
