import "server-only";
import type { MembershipPlan } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db/client";

export type Entitlements = {
  planCode: string;
  planName: string;
  isPremium: boolean;
  subscriptionId: string | null;
  endsAt: Date | null;
  interestsPerDay: number;
  canViewContacts: boolean;
  canViewPremiumOnly: boolean;
  contactViewsIncluded: number;
  contactViewsUsed: number;
  highlightProfile: boolean;
};

/** Used only if the FREE plan row is missing; deliberately conservative. */
const FALLBACK_FREE = {
  code: "FREE",
  name: "Free",
  interestsPerDay: 3,
  canViewContacts: false,
  canViewPremiumOnly: false,
  contactViewsIncluded: 0,
  highlightProfile: false,
};

type PlanLimits = Pick<
  MembershipPlan,
  | "code"
  | "name"
  | "interestsPerDay"
  | "canViewContacts"
  | "canViewPremiumOnly"
  | "contactViewsIncluded"
  | "highlightProfile"
>;

/**
 * Server-side source of truth for what a member may do. Entitlement checks
 * compare `endsAt` with the current time, so an expired subscription loses
 * access even before the expiry job marks it EXPIRED.
 */
export async function getEntitlements(userId: string, tx: Tx = db, now = new Date()): Promise<Entitlements> {
  const subscription = await tx.subscription.findFirst({
    where: { userId, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { endsAt: "desc" },
    include: { plan: true },
  });
  if (subscription) {
    const used = await tx.contactView.count({ where: { subscriptionId: subscription.id } });
    return build(subscription.plan, true, subscription.id, subscription.endsAt, used);
  }
  const free = (await tx.membershipPlan.findUnique({ where: { code: "FREE" } })) ?? FALLBACK_FREE;
  return build(free, false, null, null, 0);
}

function build(
  plan: PlanLimits,
  isPremium: boolean,
  subscriptionId: string | null,
  endsAt: Date | null,
  contactViewsUsed: number,
): Entitlements {
  return {
    planCode: plan.code,
    planName: plan.name,
    isPremium,
    subscriptionId,
    endsAt,
    interestsPerDay: plan.interestsPerDay,
    canViewContacts: plan.canViewContacts,
    canViewPremiumOnly: plan.canViewPremiumOnly,
    contactViewsIncluded: plan.contactViewsIncluded,
    contactViewsUsed,
    highlightProfile: plan.highlightProfile,
  };
}
