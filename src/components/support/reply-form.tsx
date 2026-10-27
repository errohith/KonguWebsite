"use client";

import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { replyTicketAction } from "@/server/actions/support";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const t = useT();
  return (
    <ActionForm action={replyTicketAction.bind(null, ticketId)} resetOnSuccess showSuccess={false}>
      <TextArea name="body" label={t("support.reply")} rows={4} />
      <SubmitButton>{t("support.send")}</SubmitButton>
    </ActionForm>
  );
}
