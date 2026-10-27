"use client";

import type { ActionState } from "@/lib/action-state";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/** Small inline form: optional note + one submit button. */
export function NoteAction({
  action,
  label,
  variant = "primary",
  notePlaceholder,
  withNote = true,
  children,
}: {
  action: Action;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  notePlaceholder?: string;
  withNote?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <ActionForm action={action} className="space-y-2" showSuccess={false}>
      {withNote && (
        <input
          name="note"
          placeholder={notePlaceholder ?? "Note (optional)"}
          className="border-line w-full rounded-lg border px-2 py-1.5 text-sm"
          maxLength={1000}
        />
      )}
      {children}
      <SubmitButton size="sm" variant={variant}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

export function SelectAction({
  action,
  name,
  options,
  defaultValue,
  label,
  withNote,
}: {
  action: Action;
  name: string;
  options: string[];
  defaultValue?: string;
  label: string;
  withNote?: boolean;
}) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2" showSuccess={false}>
      <select name={name} defaultValue={defaultValue} className="border-line rounded-lg border px-2 py-1.5 text-sm">
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {withNote && (
        <input name="note" placeholder="Reason" className="border-line rounded-lg border px-2 py-1.5 text-sm" />
      )}
      <SubmitButton size="sm" variant="secondary">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

export function RefundForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="grid gap-2 sm:grid-cols-5">
      <input
        name="amount"
        placeholder="Amount"
        required
        className="border-line rounded-lg border px-2 py-1.5 text-sm"
      />
      <input
        name="providerRefundId"
        placeholder="Provider refund id"
        className="border-line rounded-lg border px-2 py-1.5 text-sm"
      />
      <select name="status" defaultValue="PROCESSED" className="border-line rounded-lg border px-2 py-1.5 text-sm">
        <option>PROCESSED</option>
        <option>PENDING</option>
        <option>FAILED</option>
      </select>
      <input name="reason" placeholder="Reason" className="border-line rounded-lg border px-2 py-1.5 text-sm" />
      <SubmitButton size="sm" variant="secondary">
        Record refund
      </SubmitButton>
    </ActionForm>
  );
}

type PlanDefaults = {
  code?: string;
  name?: string;
  nameTa?: string | null;
  description?: string | null;
  descriptionTa?: string | null;
  price?: string;
  currency?: string;
  durationDays?: number;
  interestsPerDay?: number;
  contactViewsIncluded?: number;
  canViewContacts?: boolean;
  canViewPremiumOnly?: boolean;
  highlightProfile?: boolean;
  benefits?: string[];
  benefitsTa?: string[];
  isActive?: boolean;
  sortOrder?: number;
};

export function PlanForm({ action, d = {} }: { action: Action; d?: PlanDefaults }) {
  return (
    <ActionForm action={action}>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="code" label="Code" defaultValue={d.code} required />
        <TextField name="name" label="Name (English)" defaultValue={d.name} required />
        <TextField name="nameTa" label="Name (Tamil)" defaultValue={d.nameTa ?? ""} />
        <TextField name="price" label="Price" defaultValue={d.price ?? "0.00"} required />
        <TextField name="currency" label="Currency" defaultValue={d.currency ?? "INR"} />
        <TextField name="durationDays" type="number" label="Duration (days)" defaultValue={d.durationDays ?? 30} />
        <TextField name="interestsPerDay" type="number" label="Interests / day" defaultValue={d.interestsPerDay ?? 5} />
        <TextField
          name="contactViewsIncluded"
          type="number"
          label="Contact views included"
          defaultValue={d.contactViewsIncluded ?? 0}
        />
        <TextField name="sortOrder" type="number" label="Sort order" defaultValue={d.sortOrder ?? 0} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextArea name="description" label="Description (English)" defaultValue={d.description ?? ""} rows={2} />
        <TextArea name="descriptionTa" label="Description (Tamil)" defaultValue={d.descriptionTa ?? ""} rows={2} />
        <TextArea
          name="benefits"
          label="Benefits — one per line (English)"
          defaultValue={(d.benefits ?? []).join("\n")}
          rows={3}
        />
        <TextArea
          name="benefitsTa"
          label="Benefits — one per line (Tamil)"
          defaultValue={(d.benefitsTa ?? []).join("\n")}
          rows={3}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <CheckboxField name="canViewContacts" label="Can view contacts" defaultChecked={d.canViewContacts} />
        <CheckboxField
          name="canViewPremiumOnly"
          label="Sees premium-only profiles"
          defaultChecked={d.canViewPremiumOnly}
        />
        <CheckboxField name="highlightProfile" label="Highlight profile" defaultChecked={d.highlightProfile} />
        <CheckboxField name="isActive" label="Active" defaultChecked={d.isActive ?? true} />
      </div>
      <SubmitButton>Save plan</SubmitButton>
    </ActionForm>
  );
}

export function ContentForm({
  action,
  keys,
  d,
}: {
  action: Action;
  keys: readonly string[];
  d?: { key: string; locale: string; title: string | null; body: string };
}) {
  return (
    <ActionForm action={action}>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField name="key" label="Key" options={keys.map((k) => ({ value: k, label: k }))} defaultValue={d?.key} />
        <SelectField
          name="locale"
          label="Locale"
          options={[
            { value: "en", label: "English" },
            { value: "ta", label: "Tamil" },
          ]}
          defaultValue={d?.locale}
        />
        <TextField name="title" label="Title" defaultValue={d?.title ?? ""} />
      </div>
      <TextArea name="body" label="Body" defaultValue={d?.body ?? ""} rows={4} />
      <SubmitButton size="sm">Save content</SubmitButton>
    </ActionForm>
  );
}

export function FaqForm({
  action,
  d,
}: {
  action: Action;
  d?: { locale: string; question: string; answer: string; sortOrder: number; isPublished: boolean };
}) {
  return (
    <ActionForm action={action}>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
        <TextField name="question" label="Question" defaultValue={d?.question} required />
        <SelectField
          name="locale"
          label="Locale"
          options={[
            { value: "en", label: "English" },
            { value: "ta", label: "Tamil" },
          ]}
          defaultValue={d?.locale}
        />
        <TextField name="sortOrder" type="number" label="Order" defaultValue={d?.sortOrder ?? 0} />
      </div>
      <TextArea name="answer" label="Answer" defaultValue={d?.answer} rows={3} />
      <CheckboxField name="isPublished" label="Published" defaultChecked={d?.isPublished ?? true} />
      <SubmitButton size="sm">Save FAQ</SubmitButton>
    </ActionForm>
  );
}

export function ConfirmEraseForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2">
      <input name="confirm" placeholder="Type ERASE" className="border-line rounded-lg border px-2 py-1.5 text-sm" />
      <SubmitButton size="sm" variant="danger">
        Erase personal data now
      </SubmitButton>
    </ActionForm>
  );
}

export function ResolveReportForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="space-y-2" showSuccess={false}>
      <input
        name="note"
        placeholder="Resolution note"
        className="border-line w-full rounded-lg border px-2 py-1.5 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="suspend" className="accent-maroon-700" /> Suspend reported profile
      </label>
      <div className="flex gap-2">
        <SubmitButton size="sm" name="outcome" value="RESOLVED">
          Resolve
        </SubmitButton>
        <SubmitButton size="sm" variant="secondary" name="outcome" value="DISMISSED">
          Dismiss
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
