"use client";

import { ActionForm, SubmitButton } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { respondInterestAction, withdrawInterestAction } from "@/server/actions/members";

export function ReceivedActions({ id }: { id: string }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={respondInterestAction.bind(null, id, true)} className="space-y-1">
        <SubmitButton size="sm">{t("view.accept")}</SubmitButton>
      </ActionForm>
      <ActionForm action={respondInterestAction.bind(null, id, false)} className="space-y-1">
        <SubmitButton size="sm" variant="secondary">
          {t("view.decline")}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export function SentActions({ id }: { id: string }) {
  const t = useT();
  return (
    <ActionForm action={withdrawInterestAction.bind(null, id)} className="space-y-1">
      <SubmitButton size="sm" variant="ghost">
        {t("view.withdraw")}
      </SubmitButton>
    </ActionForm>
  );
}
