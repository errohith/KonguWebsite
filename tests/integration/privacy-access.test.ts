import { describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { searchProfiles } from "@/server/modules/discovery/service";
import { blockProfile, reportProfile } from "@/server/modules/privacy/service";
import { getProfileForViewer, revealContact, saveProfileStep, submitProfile } from "@/server/modules/profiles/service";
import { acceptedInterest, createMember, giveGold } from "../helpers/factory";

const db = getDb();

describe("profile privacy & authorisation", () => {
  it("never returns contact details or internal ids in a normal profile view", async () => {
    const viewer = await createMember({ gender: "MALE" });
    const target = await createMember({ gender: "FEMALE" });
    const view = await getProfileForViewer(viewer.session, target.publicId!);
    expect(view.contact).toBeNull();
    expect(JSON.stringify(view.profile)).not.toContain(target.user.id);
    expect(JSON.stringify(view.profile)).not.toContain(target.user.email);
    expect(view.profile).not.toHaveProperty("dateOfBirth");
  });

  it("hides same-gender, unpublished, hidden and premium-only profiles", async () => {
    const viewer = await createMember({ gender: "MALE" });
    const sameGender = await createMember({ gender: "MALE" });
    const draft = await createMember({ gender: "FEMALE", published: false });
    const hidden = await createMember({ gender: "FEMALE", visibility: "HIDDEN" });
    const premium = await createMember({ gender: "FEMALE", visibility: "PREMIUM_MEMBERS" });
    for (const m of [sameGender, draft, hidden, premium]) {
      await expect(getProfileForViewer(viewer.session, m.publicId!)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    const results = await searchProfiles(viewer.session, { pageSize: 48 });
    const ids = results.items.map((c) => c.publicId);
    for (const m of [sameGender, draft, hidden, premium]) expect(ids).not.toContain(m.publicId);
    await giveGold(viewer.user.id);
    await expect(getProfileForViewer(viewer.session, premium.publicId!)).resolves.toBeTruthy();
  });

  it("blocking hides both members from each other everywhere", async () => {
    const a = await createMember({ gender: "MALE" });
    const b = await createMember({ gender: "FEMALE" });
    await blockProfile(b.user.id, a.publicId!);
    await expect(getProfileForViewer(a.session, b.publicId!)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getProfileForViewer(b.session, a.publicId!)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const results = await searchProfiles(a.session, { pageSize: 48 });
    expect(results.items.map((c) => c.publicId)).not.toContain(b.publicId);
  });

  it("contact details require an accepted interest AND a premium plan, within quota", async () => {
    const viewer = await createMember({ gender: "MALE" });
    const t1 = await createMember({ gender: "FEMALE" });
    const t2 = await createMember({ gender: "FEMALE" });
    await expect(revealContact(viewer.session, t1.publicId!)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await acceptedInterest(viewer.profile!.id, t1.profile!.id);
    await acceptedInterest(t2.profile!.id, viewer.profile!.id);
    await expect(revealContact(viewer.session, t1.publicId!)).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
    await giveGold(viewer.user.id); // GOLD test plan includes 1 contact view
    const contact = await revealContact(viewer.session, t1.publicId!);
    expect(contact.contactPhone).toBe("+919000000000");
    // Re-viewing the same contact is free; a second target exceeds the quota.
    await expect(revealContact(viewer.session, t1.publicId!)).resolves.toBeTruthy();
    await expect(revealContact(viewer.session, t2.publicId!)).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
    expect(await db.contactView.count({ where: { viewerUserId: viewer.user.id } })).toBe(1);
  });

  it("expired subscriptions lose entitlements immediately", async () => {
    const viewer = await createMember({ gender: "MALE" });
    const t = await createMember({ gender: "FEMALE" });
    await acceptedInterest(viewer.profile!.id, t.profile!.id);
    const sub = await giveGold(viewer.user.id);
    await db.subscription.update({
      where: { id: sub.id },
      data: { startsAt: new Date(Date.now() - 2 * 86_400_000), endsAt: new Date(Date.now() - 1000) },
    });
    await expect(revealContact(viewer.session, t.publicId!)).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("prevents duplicate open reports", async () => {
    const a = await createMember({ gender: "MALE" });
    const b = await createMember({ gender: "FEMALE" });
    await reportProfile(a.user.id, b.publicId!, { reason: "FAKE_PROFILE" });
    await expect(reportProfile(a.user.id, b.publicId!, { reason: "OTHER" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("multi-step profile creation, completeness and moderated publishing", async () => {
    const m = await createMember({ gender: "FEMALE", profile: false });
    await expect(saveProfileStep(m.user.id, "career", {})).rejects.toMatchObject({ code: "VALIDATION" });
    await saveProfileStep(m.user.id, "basic", {
      createdFor: "SELF",
      displayName: "Kavya",
      maritalStatus: "NEVER_MARRIED",
    });
    await expect(submitProfile(m.user.id)).rejects.toMatchObject({ code: "VALIDATION" });
    await saveProfileStep(m.user.id, "career", { highestEducation: "MASTERS", occupation: "Architect" });
    await saveProfileStep(m.user.id, "location", { currentCity: "Erode", currentCountry: "IN" });
    await saveProfileStep(m.user.id, "contact", { contactPhone: "+919876543210" });
    const before = await db.profile.findUniqueOrThrow({ where: { userId: m.user.id } });
    expect(before.completeness).toBeGreaterThan(0);
    expect(before.gender).toBe("FEMALE");
    await expect(submitProfile(m.user.id)).resolves.toBe("PENDING_REVIEW");
  });

  it("unverified members cannot publish", async () => {
    const m = await createMember({ gender: "MALE", published: false });
    await db.user.update({ where: { id: m.user.id }, data: { status: "PENDING_VERIFICATION" } });
    await expect(submitProfile(m.user.id)).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
  });
});
