"use client";

import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { DOCUMENT_TYPES } from "@/lib/options";
import { verificationAction } from "@/server/actions/members";

export function VerificationForm() {
  const t = useT();
  return (
    <ActionForm action={verificationAction} resetOnSuccess>
      <SelectField
        name="type"
        label={t("verification.docType")}
        options={DOCUMENT_TYPES.map((d) => ({ value: d, label: t(`enums.DocumentType.${d}`) }))}
      />
      <TextField
        name="file"
        type="file"
        label={t("verification.file")}
        accept="image/jpeg,image/png,image/webp,application/pdf"
      />
      <TextField name="note" label={t("verification.note")} maxLength={1000} />
      <SubmitButton>{t("verification.submit")}</SubmitButton>
    </ActionForm>
  );
}
