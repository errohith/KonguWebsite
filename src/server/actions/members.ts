"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/http/action";
import { assertActionUser, clearSessionCookie } from "@/server/modules/auth/current";
import * as interests from "@/server/modules/interests/service";
import { uploadDocument } from "@/server/modules/media/service";
import { requestVerification } from "@/server/modules/moderation/service";
import { markAllRead } from "@/server/modules/notifications/service";
import * as privacy from "@/server/modules/privacy/service";
import { revealContact } from "@/server/modules/profiles/service";
import { DOCUMENT_TYPES } from "@/lib/options";
import { AppError } from "@/server/lib/errors";

export async function sendInterestAction(publicId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ active: true });
    await interests.sendInterest(user, publicId, String(form.get("message") ?? ""));
    refresh();
    return "view.interestSent";
  });
}

export async function respondInterestAction(interestId: string, accept: boolean, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ active: true });
    await interests.respondToInterest(user, interestId, accept);
    refresh();
  });
}

export async function withdrawInterestAction(interestId: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ active: true });
    await interests.withdrawInterest(user, interestId);
    refresh();
  });
}

export async function shortlistAction(publicId: string, add: boolean, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ active: true });
    if (add) await interests.addToShortlist(user, publicId);
    else await interests.removeFromShortlist(user, publicId);
    refresh();
  });
}

export async function revealContactAction(publicId: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ active: true });
    const contact = await revealContact(user, publicId);
    return { data: contact };
  });
}

export async function blockAction(publicId: string, _: ActionState): Promise<ActionState> {
  let done = false;
  const state = await runAction(async () => {
    const user = await assertActionUser();
    await privacy.blockProfile(user.id, publicId);
    done = true;
  });
  if (done) redirect("/settings#blocked");
  return state;
}

export async function unblockAction(blockId: string) {
  const user = await assertActionUser();
  await privacy.unblock(user.id, blockId);
  refresh();
}

export async function reportAction(publicId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser();
    await privacy.reportProfile(user.id, publicId, formToObject(form));
    return "view.reportSent";
  });
}

export async function deactivateAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser();
    await privacy.deactivateAccount(user.id, String(form.get("password") ?? ""));
    refresh();
  });
}

export async function reactivateAction() {
  const user = await assertActionUser();
  await privacy.reactivateAccount(user.id);
  refresh();
}

export async function deleteAccountAction(_: ActionState, form: FormData): Promise<ActionState> {
  let done = false;
  const state = await runAction(async () => {
    const user = await assertActionUser();
    await privacy.requestAccountDeletion(user.id, String(form.get("password") ?? ""));
    done = true;
  });
  if (done) {
    await clearSessionCookie();
    redirect("/?deleted=1");
  }
  return state;
}

export async function verificationAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ active: true });
    const type = String(form.get("type"));
    if (!(DOCUMENT_TYPES as readonly string[]).includes(type)) throw new AppError("VALIDATION");
    const doc = await uploadDocument(user.id, type as (typeof DOCUMENT_TYPES)[number], form.get("file") as File);
    await requestVerification(user.id, doc.id, String(form.get("note") ?? ""));
    refresh();
    return "verification.submitted";
  });
}

export async function markNotificationsReadAction() {
  const user = await assertActionUser();
  await markAllRead(user.id);
  refresh();
}
