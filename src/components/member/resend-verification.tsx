"use client";

import { ActionForm, SubmitButton } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { resendVerificationAction } from "@/server/actions/auth";

export function ResendVerification() {
  const t = useT();
  return (
    <ActionForm action={resendVerificationAction} className="space-y-2">
      <SubmitButton size="sm" variant="secondary">
        {t("auth.resend")}
      </SubmitButton>
    </ActionForm>
  );
}
