import { describe, expect, it } from "vitest";
import {
  decideAccess,
  type RelationshipFacts,
  type TargetFacts,
  type ViewerFacts,
} from "@/server/modules/profiles/access";

const viewer: ViewerFacts = {
  userId: "v",
  gender: "MALE",
  canViewPremiumOnly: false,
  canViewContacts: false,
  contactQuotaRemaining: false,
};
const target: TargetFacts = {
  ownerUserId: "t",
  ownerStatus: "ACTIVE",
  gender: "FEMALE",
  status: "PUBLISHED",
  visibility: "MEMBERS",
  photoVisibility: "MEMBERS",
};
const rel: RelationshipFacts = { blockedEitherWay: false, acceptedInterest: false, contactAlreadyViewed: false };

describe("profile access rules", () => {
  it("owner sees everything", () => {
    const d = decideAccess({ ...viewer, userId: "t" }, target, rel);
    expect(d).toMatchObject({ canView: true, isOwner: true, canSeeContact: true });
  });
  it("members see published opposite-gender profiles but not contacts", () => {
    const d = decideAccess(viewer, target, rel);
    expect(d.canView).toBe(true);
    expect(d.canSeeContact).toBe(false);
    expect(d.contactLockedReason).toBe("NEEDS_ACCEPTED_INTEREST");
  });
  it.each([
    ["blocked", target, { ...rel, blockedEitherWay: true }],
    ["same gender", { ...target, gender: "MALE" as const }, rel],
    ["unpublished", { ...target, status: "DRAFT" as const }, rel],
    ["suspended owner", { ...target, ownerStatus: "SUSPENDED" as const }, rel],
    ["deactivated owner", { ...target, ownerStatus: "DEACTIVATED" as const }, rel],
    ["hidden profile", { ...target, visibility: "HIDDEN" as const }, rel],
    ["premium-only for free viewer", { ...target, visibility: "PREMIUM_MEMBERS" as const }, rel],
  ])("denies: %s", (_name, t, r) => {
    expect(decideAccess(viewer, t, r).canView).toBe(false);
  });
  it("hidden/premium profiles are visible after an accepted interest", () => {
    const r = { ...rel, acceptedInterest: true };
    expect(decideAccess(viewer, { ...target, visibility: "HIDDEN" }, r).canView).toBe(true);
    expect(decideAccess(viewer, { ...target, visibility: "PREMIUM_MEMBERS" }, r).canView).toBe(true);
  });
  it("photo visibility follows the owner's setting", () => {
    expect(decideAccess(viewer, { ...target, photoVisibility: "ACCEPTED_INTERESTS" }, rel).canSeePhotos).toBe(false);
    expect(
      decideAccess(viewer, { ...target, photoVisibility: "ACCEPTED_INTERESTS" }, { ...rel, acceptedInterest: true })
        .canSeePhotos,
    ).toBe(true);
    expect(
      decideAccess(viewer, { ...target, photoVisibility: "HIDDEN" }, { ...rel, acceptedInterest: true }).canSeePhotos,
    ).toBe(false);
  });
  it("contact requires accepted interest, premium entitlement and quota", () => {
    const accepted = { ...rel, acceptedInterest: true };
    expect(decideAccess(viewer, target, accepted).contactLockedReason).toBe("NEEDS_PREMIUM");
    const premium = { ...viewer, canViewContacts: true };
    expect(decideAccess(premium, target, accepted).contactLockedReason).toBe("QUOTA_EXHAUSTED");
    expect(decideAccess({ ...premium, contactQuotaRemaining: true }, target, accepted).contactLockedReason).toBeNull();
    // Already unlocked contacts stay visible without new quota.
    const d = decideAccess(premium, target, { ...accepted, contactAlreadyViewed: true });
    expect(d.canSeeContact).toBe(true);
  });
});
