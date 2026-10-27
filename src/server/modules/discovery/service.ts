import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, formatPublicId, MARITAL_STATUSES } from "@/lib/options";
import { db } from "@/server/db/client";
import { ageOn, dobRangeForAges } from "@/server/lib/dates";
import { checkbox, enumArray, optionalInt } from "@/server/lib/validation";
import { getEntitlements } from "@/server/modules/membership/entitlements";
import { searchableVisibilities } from "@/server/modules/profiles/access";

export const PAGE_SIZE_MAX = 48;

export const searchSchema = z.object({
  ageMin: optionalInt(18, 80),
  ageMax: optionalInt(18, 80),
  heightMinCm: optionalInt(100, 250),
  heightMaxCm: optionalInt(100, 250),
  maritalStatus: enumArray(MARITAL_STATUSES),
  education: enumArray(EDUCATION_LEVELS),
  employment: enumArray(EMPLOYMENT_TYPES),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  state: z.string().trim().max(60).optional(),
  city: z.string().trim().max(80).optional(),
  occupation: z.string().trim().max(80).optional(),
  excludeKootam: checkbox,
  verifiedOnly: checkbox,
  withPhoto: checkbox,
  sort: z.enum(["newest", "active", "age_asc", "age_desc"]).catch("newest").default("newest"),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).catch(12).default(12),
});
export type SearchInput = z.input<typeof searchSchema>;
export type SearchFilters = z.output<typeof searchSchema>;

export type ProfileCard = {
  publicId: string;
  displayName: string;
  age: number;
  heightCm: number | null;
  highestEducation: string | null;
  occupation: string | null;
  currentCity: string | null;
  currentState: string | null;
  currentCountry: string | null;
  kootam: string | null;
  verified: boolean;
  primaryPhotoId: string | null;
  shortlisted: boolean;
  highlighted: boolean;
};

const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });

/**
 * Builds the WHERE clause shared by search and matches. Visibility,
 * account status, gender and blocks are always enforced here, whatever
 * filters the client sends.
 */
async function baseWhere(viewer: { id: string; gender: "MALE" | "FEMALE" }) {
  const [ent, viewerProfile, blocks] = await Promise.all([
    getEntitlements(viewer.id),
    db.profile.findUnique({ where: { userId: viewer.id }, select: { id: true, kootam: true } }),
    db.block.findMany({
      where: { OR: [{ blockerUserId: viewer.id }, { blockedUserId: viewer.id }] },
      select: { blockerUserId: true, blockedUserId: true },
    }),
  ]);
  const blockedUserIds = blocks.map((b) => (b.blockerUserId === viewer.id ? b.blockedUserId : b.blockerUserId));
  const where: Prisma.ProfileWhereInput = {
    status: "PUBLISHED",
    gender: viewer.gender === "MALE" ? "FEMALE" : "MALE",
    visibility: { in: searchableVisibilities(ent.canViewPremiumOnly) },
    user: { status: "ACTIVE" },
    userId: { notIn: [viewer.id, ...blockedUserIds] },
  };
  return { where, viewerProfile };
}

function applyFilters(where: Prisma.ProfileWhereInput, f: SearchFilters, viewerKootam: string | null | undefined) {
  const and: Prisma.ProfileWhereInput[] = [];
  const { latest, earliestExclusive } = dobRangeForAges(f.ageMin ?? undefined, f.ageMax ?? undefined);
  if (latest || earliestExclusive) {
    and.push({
      dateOfBirth: { ...(latest ? { lte: latest } : {}), ...(earliestExclusive ? { gt: earliestExclusive } : {}) },
    });
  }
  if (f.heightMinCm !== null || f.heightMaxCm !== null) {
    and.push({
      heightCm: {
        ...(f.heightMinCm !== null ? { gte: f.heightMinCm } : {}),
        ...(f.heightMaxCm !== null ? { lte: f.heightMaxCm } : {}),
      },
    });
  }
  if (f.maritalStatus.length) and.push({ maritalStatus: { in: f.maritalStatus } });
  if (f.education.length) and.push({ highestEducation: { in: f.education } });
  if (f.employment.length) and.push({ employmentType: { in: f.employment } });
  if (f.country) and.push({ currentCountry: f.country });
  if (f.state) and.push({ currentState: ci(f.state) });
  if (f.city) and.push({ currentCity: ci(f.city) });
  if (f.occupation) and.push({ occupation: ci(f.occupation) });
  if (f.excludeKootam && viewerKootam) {
    and.push({ OR: [{ kootam: null }, { NOT: { kootam: { equals: viewerKootam, mode: "insensitive" } } }] });
  }
  if (f.verifiedOnly) and.push({ verificationState: "VERIFIED" });
  if (f.withPhoto) and.push({ photos: { some: { moderationStatus: "APPROVED" } }, photoVisibility: "MEMBERS" });
  return and.length ? { ...where, AND: and } : where;
}

const ORDER: Record<SearchFilters["sort"], Prisma.ProfileOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: "desc" }, { id: "asc" }],
  active: [{ lastActiveAt: "desc" }, { id: "asc" }],
  age_asc: [{ dateOfBirth: "desc" }, { id: "asc" }],
  age_desc: [{ dateOfBirth: "asc" }, { id: "asc" }],
};

async function runQuery(
  viewerId: string,
  where: Prisma.ProfileWhereInput,
  f: Pick<SearchFilters, "sort" | "page" | "pageSize">,
) {
  const [total, rows] = await Promise.all([
    db.profile.count({ where }),
    db.profile.findMany({
      where,
      orderBy: ORDER[f.sort],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        userId: true,
        profileNumber: true,
        displayName: true,
        dateOfBirth: true,
        heightCm: true,
        highestEducation: true,
        occupation: true,
        currentCity: true,
        currentState: true,
        currentCountry: true,
        kootam: true,
        verificationState: true,
        photoVisibility: true,
        photos: {
          where: { moderationStatus: "APPROVED", isPrimary: true },
          select: { id: true },
          take: 1,
        },
        shortlistedBy: { where: { userId: viewerId }, select: { id: true } },
      },
    }),
  ]);
  const highlightedUsers = new Set(
    (
      await db.subscription.findMany({
        where: {
          userId: { in: rows.map((r) => r.userId) },
          status: "ACTIVE",
          endsAt: { gt: new Date() },
          plan: { highlightProfile: true },
        },
        select: { userId: true },
      })
    ).map((s) => s.userId),
  );
  const items: ProfileCard[] = rows.map((r) => ({
    publicId: formatPublicId(r.profileNumber),
    displayName: r.displayName,
    age: ageOn(r.dateOfBirth),
    heightCm: r.heightCm,
    highestEducation: r.highestEducation,
    occupation: r.occupation,
    currentCity: r.currentCity,
    currentState: r.currentState,
    currentCountry: r.currentCountry,
    kootam: r.kootam,
    verified: r.verificationState === "VERIFIED",
    // Photo only in cards when the owner allows all members to see photos.
    primaryPhotoId: r.photoVisibility === "MEMBERS" ? (r.photos[0]?.id ?? null) : null,
    shortlisted: r.shortlistedBy.length > 0,
    highlighted: highlightedUsers.has(r.userId),
  }));
  return { items, total, page: f.page, pageSize: f.pageSize, pageCount: Math.max(1, Math.ceil(total / f.pageSize)) };
}

export async function searchProfiles(
  viewer: { id: string; gender: "MALE" | "FEMALE" },
  raw: SearchInput | Record<string, unknown>,
) {
  const f = searchSchema.parse(raw);
  const { where, viewerProfile } = await baseWhere(viewer);
  return runQuery(viewer.id, applyFilters(where, f, viewerProfile?.kootam), f);
}

/** Profiles matching the viewer's saved partner preferences. */
export async function matchesForViewer(viewer: { id: string; gender: "MALE" | "FEMALE" }, page = 1) {
  const { where, viewerProfile } = await baseWhere(viewer);
  const pref = viewerProfile ? await db.partnerPreference.findUnique({ where: { profileId: viewerProfile.id } }) : null;
  const f = searchSchema.parse({
    ageMin: pref?.ageMin ?? undefined,
    ageMax: pref?.ageMax ?? undefined,
    heightMinCm: pref?.heightMinCm ?? undefined,
    heightMaxCm: pref?.heightMaxCm ?? undefined,
    maritalStatus: pref?.maritalStatuses ?? [],
    education: pref?.educationLevels ?? [],
    employment: pref?.employmentTypes ?? [],
    excludeKootam: pref?.excludeSameKootam ?? true,
    sort: "active",
    page,
  });
  let filtered = applyFilters(where, f, viewerProfile?.kootam);
  const locationOr: Prisma.ProfileWhereInput[] = [];
  if (pref?.countries.length) locationOr.push({ currentCountry: { in: pref.countries } });
  if (pref?.states.length) locationOr.push({ currentState: { in: pref.states, mode: "insensitive" } });
  if (locationOr.length) filtered = { AND: [filtered, { OR: locationOr }] };
  return { ...(await runQuery(viewer.id, filtered, f)), hasPreferences: !!pref };
}

/** Cards for an explicit list of profile ids (shortlist, interests), with the same visibility rules. */
export async function cardsForProfileIds(viewer: { id: string; gender: "MALE" | "FEMALE" }, profileIds: string[]) {
  if (!profileIds.length) return new Map<string, ProfileCard>();
  const { where } = await baseWhere(viewer);
  const rows = await db.profile.findMany({
    where: { ...where, id: { in: profileIds } },
    select: { id: true, profileNumber: true },
  });
  const res = await runQuery(
    viewer.id,
    { id: { in: rows.map((r) => r.id) } },
    { sort: "newest", page: 1, pageSize: PAGE_SIZE_MAX * 4 },
  );
  const byNumber = new Map(rows.map((r) => [formatPublicId(r.profileNumber), r.id]));
  return new Map(res.items.map((c) => [byNumber.get(c.publicId)!, c]));
}
