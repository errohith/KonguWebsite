"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { formToObject, runAction } from "@/server/http/action";
import { assertActionUser, getClientMeta, getCurrentUser } from "@/server/modules/auth/current";
import { hasPermission } from "@/server/modules/auth/permissions";
import * as support from "@/server/modules/support/service";
import { getT } from "@/i18n/server";

export async function createTicketAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const ticket = await support.createTicket(formToObject(form), { userId: user?.id, ip: (await getClientMeta()).ip });
    const t = await getT();
    refresh();
    return { message: t("contact.sent", { id: ticket.id.slice(0, 8).toUpperCase() }) };
  });
}

export async function replyTicketAction(ticketId: string, _: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser();
    await support.replyToTicket(
      user.id,
      ticketId,
      String(form.get("body") ?? ""),
      hasPermission(user.role, "support.manage"),
    );
    refresh();
  });
}
