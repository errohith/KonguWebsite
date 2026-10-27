import { hash } from "@node-rs/argon2";
import type { Gender } from "@/generated/prisma/enums";
import { getDb } from "@/server/db/client";
import type { SessionUser } from "@/server/modules/auth/sessions";

let n = 0;
const PASSWORD = "Password123";
let pwHash: string | undefined;

export const TEST_PASSWORD = PASSWORD;

/** Creates an ACTIVE, verified member, optionally with a published profile. */
export async function createMember(opts: {
  gender: Gender;
  profile?: boolean;
  published?: boolean;
  kootam?: string;
  visibility?: "MEMBERS" | "PREMIUM_MEMBERS" | "HIDDEN";
  photoVisibility?: "MEMBERS" | "ACCEPTED_INTERESTS" | "HIDDEN";
  age?: number;
}) {
  const db = getDb();
  pwHash ??= await hash(PASSWORD, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  n++;
  const age = opts.age ?? 28;
  const dob = new Date(Date.UTC(new Date().getUTCFullYear() - age, 0, 1));
  const user = await db.user.create({
    data: {
      email: `member${n}-${Date.now()}@example.invalid`,
      passwordHash: pwHash,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      dateOfBirth: dob,
      gender: opts.gender,
    },
  });
  let profile = null;
  if (opts.profile !== false) {
    profile = await db.profile.create({
      data: {
        userId: user.id,
        displayName: `Test ${n}`,
        gender: opts.gender,
        dateOfBirth: dob,
        kootam: opts.kootam ?? null,
        highestEducation: "BACHELORS",
        occupation: "Engineer",
        currentCity: "Erode",
        currentCountry: "IN",
        status: opts.published === false ? "DRAFT" : "PUBLISHED",
        publishedAt: opts.published === false ? null : new Date(),
        visibility: opts.visibility ?? "MEMBERS",
        photoVisibility: opts.photoVisibility ?? "MEMBERS",
        contact: { create: { contactPhone: "+919000000000", contactEmail: `contact${n}@example.invalid` } },
      },
    });
  }
  const session: SessionUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    gender: user.gender,
    locale: user.locale,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: null,
  };
  return { user, profile, session, publicId: profile ? `KM${profile.profileNumber}` : null };
}

export async function giveGold(userId: string) {
  const db = getDb();
  const plan = await db.membershipPlan.findUniqueOrThrow({ where: { code: "GOLD" } });
  return db.subscription.create({
    data: { userId, planId: plan.id, startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86_400_000) },
  });
}

export async function acceptedInterest(senderProfileId: string, receiverProfileId: string) {
  return getDb().interest.create({
    data: { senderProfileId, receiverProfileId, status: "ACCEPTED", respondedAt: new Date() },
  });
}
