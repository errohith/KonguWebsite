import { describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { searchProfiles } from "@/server/modules/discovery/service";
import {
  deactivateAccount,
  exportUserData,
  processDueDeletions,
  reactivateAccount,
  requestAccountDeletion,
} from "@/server/modules/privacy/service";
import { createMember, TEST_PASSWORD } from "../helpers/factory";

const db = getDb();

describe("account lifecycle", () => {
  it("deactivation hides the profile; reactivation restores it", async () => {
    const viewer = await createMember({ gender: "MALE" });
    const m = await createMember({ gender: "FEMALE" });
    await expect(deactivateAccount(m.user.id, "wrong-password")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await deactivateAccount(m.user.id, TEST_PASSWORD);
    expect((await searchProfiles(viewer.session, { pageSize: 48 })).items.map((c) => c.publicId)).not.toContain(
      m.publicId,
    );
    await reactivateAccount(m.user.id);
    expect((await searchProfiles(viewer.session, { pageSize: 48 })).items.map((c) => c.publicId)).toContain(m.publicId);
  });

  it("exports personal data without credentials", async () => {
    const m = await createMember({ gender: "MALE" });
    const out = JSON.stringify(await exportUserData(m.user.id));
    expect(out).toContain(m.user.email);
    expect(out).not.toContain("passwordHash");
    expect(out).not.toContain("$argon2");
  });

  it("erases personal data after the grace period but retains payment records", async () => {
    const m = await createMember({ gender: "FEMALE" });
    const plan = await db.membershipPlan.findUniqueOrThrow({ where: { code: "GOLD" } });
    await db.payment.create({
      data: { userId: m.user.id, planId: plan.id, provider: "razorpay", amount: "999.00", status: "CAPTURED" },
    });
    const { scheduledFor } = await requestAccountDeletion(m.user.id, TEST_PASSWORD);
    expect(scheduledFor.getTime()).toBeGreaterThan(Date.now());
    expect(await processDueDeletions(new Date())).toBe(0); // grace period not over
    expect(await processDueDeletions(new Date(scheduledFor.getTime() + 1000))).toBe(1);
    const user = await db.user.findUniqueOrThrow({ where: { id: m.user.id } });
    expect(user.status).toBe("DELETED");
    expect(user.email).not.toBe(m.user.email);
    expect(user.phone).toBeNull();
    expect(await db.profile.findUnique({ where: { userId: m.user.id } })).toBeNull();
    expect(await db.profileContact.count({ where: { profileId: m.profile!.id } })).toBe(0);
    expect(await db.payment.count({ where: { userId: m.user.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "user.erase", entityId: m.user.id } })).toBe(1);
  });
});
