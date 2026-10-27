import type { Gender, PhotoVisibility, ProfileStatus, ProfileVisibility, UserStatus } from "@/generated/prisma/enums";

/**
 * Pure authorisation rules for profile, photo and contact access.
 * Kept free of I/O so every rule is unit-testable; `service.ts` loads the
 * facts (blocks, interests, entitlements) and calls these.
 */

export type ViewerFacts = {
  userId: string;
  gender: Gender;
  canViewPremiumOnly: boolean;
  canViewContacts: boolean;
  contactQuotaRemaining: boolean;
};

export type TargetFacts = {
  ownerUserId: string;
  ownerStatus: UserStatus;
  gender: Gender;
  status: ProfileStatus;
  visibility: ProfileVisibility;
  photoVisibility: PhotoVisibility;
};

export type RelationshipFacts = {
  blockedEitherWay: boolean;
  acceptedInterest: boolean;
  /** Viewer already unlocked this contact (does not consume quota again). */
  contactAlreadyViewed: boolean;
};

export type AccessDecision = {
  canView: boolean;
  isOwner: boolean;
  canSeePhotos: boolean;
  canSeeContact: boolean;
  /** Contact is unlockable but needs a premium plan / more quota. */
  contactLockedReason: null | "NEEDS_ACCEPTED_INTEREST" | "NEEDS_PREMIUM" | "QUOTA_EXHAUSTED";
};

const DENY: AccessDecision = {
  canView: false,
  isOwner: false,
  canSeePhotos: false,
  canSeeContact: false,
  contactLockedReason: null,
};

export function decideAccess(viewer: ViewerFacts, target: TargetFacts, rel: RelationshipFacts): AccessDecision {
  if (viewer.userId === target.ownerUserId) {
    return { canView: true, isOwner: true, canSeePhotos: true, canSeeContact: true, contactLockedReason: null };
  }
  if (rel.blockedEitherWay) return DENY;
  if (target.ownerStatus !== "ACTIVE" || target.status !== "PUBLISHED") return DENY;
  // Members browse profiles of the opposite gender only.
  if (viewer.gender === target.gender) return DENY;

  const visible =
    target.visibility === "MEMBERS" ||
    (target.visibility === "PREMIUM_MEMBERS" && (viewer.canViewPremiumOnly || rel.acceptedInterest)) ||
    (target.visibility === "HIDDEN" && rel.acceptedInterest);
  if (!visible) return DENY;

  const canSeePhotos =
    target.photoVisibility === "MEMBERS" || (target.photoVisibility === "ACCEPTED_INTERESTS" && rel.acceptedInterest);

  let contactLockedReason: AccessDecision["contactLockedReason"] = null;
  if (!rel.acceptedInterest) contactLockedReason = "NEEDS_ACCEPTED_INTEREST";
  else if (!viewer.canViewContacts) contactLockedReason = "NEEDS_PREMIUM";
  else if (!rel.contactAlreadyViewed && !viewer.contactQuotaRemaining) contactLockedReason = "QUOTA_EXHAUSTED";

  return {
    canView: true,
    isOwner: false,
    canSeePhotos,
    // Contact is never revealed by merely viewing; it is unlocked explicitly
    // (see revealContact) once these preconditions hold.
    canSeeContact: contactLockedReason === null && rel.contactAlreadyViewed,
    contactLockedReason,
  };
}

/** Whether the profile may appear in search results for this viewer. */
export function searchableVisibilities(canViewPremiumOnly: boolean): ProfileVisibility[] {
  return canViewPremiumOnly ? ["MEMBERS", "PREMIUM_MEMBERS"] : ["MEMBERS"];
}
