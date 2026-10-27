"use client";

import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { TICKET_CATEGORIES } from "@/lib/options";
import { createTicketAction } from "@/server/actions/support";

export function TicketForm({ defaultEmail }: { defaultEmail?: string }) {
  const t = useT();
  return (
    <ActionForm action={createTicketAction} resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label={t("contact.name")} autoComplete="name" required />
        <TextField
          name="email"
          type="email"
          label={t("contact.email")}
          defaultValue={defaultEmail}
          autoComplete="email"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField name="subject" label={t("contact.subject")} required />
        <SelectField
          name="category"
          label={t("contact.category")}
          options={TICKET_CATEGORIES.map((c) => ({ value: c, label: t(`enums.TicketCategory.${c}`) }))}
        />
      </div>
      <TextArea name="message" label={t("contact.message")} rows={6} required />
      <SubmitButton>{t("contact.send")}</SubmitButton>
    </ActionForm>
  );
}
