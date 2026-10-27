import { describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { listInterests, respondToInterest, sendInterest, withdrawInterest } from "@/server/modules/interests/service";
import { createMember } from "../helpers/factory";

const db = getDb();

describe("interests", () => {
  it("sends, prevents duplicates in both directions, and notifies the receiver", async () => {
    const a = await createMember({ gender: "MALE" });
    const b = await createMember({ gender: "FEMALE" });
    const interest = await sendInterest(a.session, b.publicId!, "Hello");
    expect(interest.status).toBe("PENDING");
    await expect(sendInterest(a.session, b.publicId!)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "errors.interestAlreadySent",
    });
    await expect(sendInterest(b.session, a.publicId!)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "errors.interestReverseExists",
    });
    expect(await db.notification.count({ where: { userId: b.user.id, type: "INTEREST_RECEIVED" } })).toBe(1);
    expect((await listInterests(b.session, "received"))[0].otherPublicId).toBe(a.publicId);
  });

  it("concurrent duplicate sends create exactly one interest", async () => {
    const a = await createMember({ gender: "MALE" });
    const b = await createMember({ gender: "FEMALE" });
    const results = await Promise.allSettled([
      sendInterest(a.session, b.publicId!),
      sendInterest(a.session, b.publicId!),
      sendInterest(a.session, b.publicId!),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.interest.count({ where: { senderProfileId: a.profile!.id } })).toBe(1);
  });

  it("enforces the plan's daily interest quota (FREE = 2 in tests)", async () => {
    const a = await createMember({ gender: "MALE" });
    const targets = await Promise.all([1, 2, 3].map(() => createMember({ gender: "FEMALE" })));
    await sendInterest(a.session, targets[0].publicId!);
    await sendInterest(a.session, targets[1].publicId!);
    await expect(sendInterest(a.session, targets[2].publicId!)).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("only the receiver can respond, only the sender can withdraw", async () => {
    const a = await createMember({ gender: "MALE" });
    const b = await createMember({ gender: "FEMALE" });
    const outsider = await createMember({ gender: "FEMALE" });
    const i = await sendInterest(a.session, b.publicId!);
    await expect(respondToInterest(a.session, i.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(respondToInterest(outsider.session, i.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(withdrawInterest(b.session, i.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await respondToInterest(b.session, i.id, true);
    await expect(respondToInterest(b.session, i.id, false)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(withdrawInterest(a.session, i.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires a published profile to send", async () => {
    const draft = await createMember({ gender: "MALE", published: false });
    const b = await createMember({ gender: "FEMALE" });
    await expect(sendInterest(draft.session, b.publicId!)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
