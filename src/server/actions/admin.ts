"use server";

import { refresh } from "next/cache";
import { UserRole } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/http/action";
import { AppError } from "@/server/lib/errors";
import * as admin from "@/server/modules/admin/service";
import { assertActionUser } from "@/server/modules/auth/current";
import * as content from "@/server/modules/content/service";
import { upsertPlan } from "@/server/modules/membership/plans";
import * as moderation from "@/server/modules/moderation/service";
import * as payments from "@/server/modules/payments/service";
import { eraseUser } from "@/server/modules/privacy/service";
import { setTicketStatus } from "@/server/modules/support/service";

/** Every admin action re-checks the permission server-side. */

const note = (form: FormData) => String(form.get("note") ?? "");

export async function reviewProfileAction(
  profileId: string,
  approve: boolean,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "moderation.manage" });
    await moderation.reviewProfile(user.id, profileId, approve, note(form));
    refresh();
  });
}

export async function suspendProfileAction(
  profileId: string,
  suspend: boolean,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "moderation.manage" });
    await moderation.setProfileSuspended(user.id, profileId, suspend, note(form));
    refresh();
  });
}

export async function reviewPhotoAction(
  photoId: string,
  approve: boolean,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "moderation.manage" });
    await moderation.reviewPhoto(user.id, photoId, approve, note(form));
    refresh();
  });
}

export async function reviewVerificationAction(
  requestId: string,
  approve: boolean,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "moderation.manage" });
    await moderation.reviewVerification(user.id, requestId, approve, note(form));
    refresh();
  });
}

export async function resolveReportAction(reportId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "moderation.manage" });
    const outcome = form.get("outcome") === "DISMISSED" ? "DISMISSED" : "RESOLVED";
    await moderation.resolveReport(user.id, reportId, outcome, note(form), form.get("suspend") === "on");
    refresh();
  });
}

export async function setMemberStatusAction(userId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "members.manage" });
    const status = form.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
    await admin.setMemberStatus(user.id, userId, status, note(form));
    refresh();
  });
}

export async function setMemberRoleAction(userId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "roles.manage" });
    const role = String(form.get("role"));
    if (!(Object.values(UserRole) as string[]).includes(role)) throw new AppError("VALIDATION");
    await admin.setMemberRole(user.id, userId, role as UserRole);
    refresh();
  });
}

export async function eraseMemberAction(userId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "members.manage" });
    if (form.get("confirm") !== "ERASE") throw new AppError("VALIDATION", "Type ERASE to confirm");
    await eraseUser(userId, user.id);
    refresh();
  });
}

export async function grantSubscriptionAction(userId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "payments.manage" });
    await payments.grantSubscription(user.id, userId, String(form.get("planCode") ?? ""));
    refresh();
  });
}

export async function cancelSubscriptionAction(
  subscriptionId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "payments.manage" });
    await payments.cancelSubscription(user.id, subscriptionId, note(form));
    refresh();
  });
}

export async function recordRefundAction(paymentId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "payments.manage" });
    const raw = formToObject(form) as Record<string, string>;
    await payments.recordRefund(user.id, paymentId, {
      amount: raw.amount,
      providerRefundId: raw.providerRefundId,
      status: raw.status as "PENDING" | "PROCESSED" | "FAILED",
      reason: raw.reason,
    });
    refresh();
  });
}

export async function savePlanAction(planId: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "plans.manage" });
    await upsertPlan(user.id, formToObject(form), planId ?? undefined);
    refresh();
    return "profile.saved";
  });
}

export async function saveContentAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "content.manage" });
    await content.upsertContent(user.id, formToObject(form));
    refresh();
    return "profile.saved";
  });
}

export async function saveFaqAction(faqId: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "content.manage" });
    await content.upsertFaq(user.id, formToObject(form), faqId ?? undefined);
    refresh();
    return "profile.saved";
  });
}

export async function deleteFaqAction(faqId: string) {
  const user = await assertActionUser({ permission: "content.manage" });
  await content.deleteFaq(user.id, faqId);
  refresh();
}

export async function setTicketStatusAction(ticketId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ permission: "support.manage" });
    const status = String(form.get("status"));
    if (!["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) throw new AppError("VALIDATION");
    await setTicketStatus(user.id, ticketId, status as "OPEN");
    refresh();
  });
}
