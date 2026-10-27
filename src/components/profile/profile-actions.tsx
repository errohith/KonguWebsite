"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/card";
import { ActionForm, SelectField, SubmitButton, TextArea } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { REPORT_REASONS } from "@/lib/options";
import {
  blockAction,
  reportAction,
  respondInterestAction,
  revealContactAction,
  sendInterestAction,
  shortlistAction,
  withdrawInterestAction,
} from "@/server/actions/members";

type InterestState = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";
  direction: "sent" | "received";
} | null;

export function InterestPanel({ publicId, interest }: { publicId: string; interest: InterestState }) {
  const t = useT();
  if (!interest) {
    return (
      <ActionForm action={sendInterestAction.bind(null, publicId)}>
        <TextArea name="message" label={t("view.interestMessage")} rows={2} maxLength={500} />
        <SubmitButton className="w-full">{t("view.sendInterest")}</SubmitButton>
      </ActionForm>
    );
  }
  const status = t(`enums.InterestStatus.${interest.status}`);
  if (interest.direction === "received" && interest.status === "PENDING") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">{t("view.interestReceived")}</p>
        <div className="flex gap-2">
          <ActionForm action={respondInterestAction.bind(null, interest.id, true)}>
            <SubmitButton>{t("view.accept")}</SubmitButton>
          </ActionForm>
          <ActionForm action={respondInterestAction.bind(null, interest.id, false)}>
            <SubmitButton variant="secondary">{t("view.decline")}</SubmitButton>
          </ActionForm>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {interest.direction === "sent" ? t("view.interestSent") : t("view.interestReceived")} ·{" "}
        <strong>{status}</strong>
      </p>
      {interest.direction === "sent" && interest.status === "PENDING" && (
        <ActionForm action={withdrawInterestAction.bind(null, interest.id)}>
          <SubmitButton variant="ghost" size="sm">
            {t("view.withdraw")}
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function ShortlistButton({ publicId, shortlisted }: { publicId: string; shortlisted: boolean }) {
  const t = useT();
  return (
    <ActionForm action={shortlistAction.bind(null, publicId, !shortlisted)} showSuccess={false}>
      <SubmitButton variant="secondary" size="sm" className="w-full">
        {shortlisted ? `★ ${t("view.shortlisted")}` : `☆ ${t("view.shortlist")}`}
      </SubmitButton>
    </ActionForm>
  );
}

type Contact = {
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  relationship: string | null;
};

export function ContactPanel({
  publicId,
  contact,
  lockedReason,
}: {
  publicId: string;
  contact: Contact | null;
  lockedReason: null | "NEEDS_ACCEPTED_INTEREST" | "NEEDS_PREMIUM" | "QUOTA_EXHAUSTED";
}) {
  const t = useT();
  const [state, action, pending] = useActionState(revealContactAction.bind(null, publicId), null);
  const shown = (state?.ok ? (state.data as Contact) : null) ?? contact;

  if (shown) {
    return (
      <dl className="space-y-1 text-sm">
        {shown.contactName && (
          <div>
            <dt className="text-muted inline">{t("profile.fields.contactName")}: </dt>
            <dd className="inline">
              {shown.contactName}
              {shown.relationship ? ` (${shown.relationship})` : ""}
            </dd>
          </div>
        )}
        {shown.contactPhone && (
          <div>
            <dt className="text-muted inline">{t("profile.fields.contactPhone")}: </dt>
            <dd className="inline">
              <a className="underline" href={`tel:${shown.contactPhone}`}>
                {shown.contactPhone}
              </a>
            </dd>
          </div>
        )}
        {shown.contactEmail && (
          <div>
            <dt className="text-muted inline">{t("profile.fields.contactEmail")}: </dt>
            <dd className="inline">
              <a className="underline" href={`mailto:${shown.contactEmail}`}>
                {shown.contactEmail}
              </a>
            </dd>
          </div>
        )}
      </dl>
    );
  }
  if (lockedReason === "NEEDS_ACCEPTED_INTEREST")
    return <p className="text-muted text-sm">{t("view.contactNeedsInterest")}</p>;
  if (lockedReason === "NEEDS_PREMIUM") return <p className="text-muted text-sm">{t("view.contactNeedsPremium")}</p>;
  if (lockedReason === "QUOTA_EXHAUSTED") return <p className="text-muted text-sm">{t("view.contactQuota")}</p>;
  return (
    <form action={action} className="space-y-2">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <button
        className="bg-maroon-700 hover:bg-maroon-800 w-full rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={pending}
      >
        {t("view.viewContact")}
      </button>
    </form>
  );
}

export function SafetyActions({ publicId }: { publicId: string }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <details className="border-line rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t("view.report")}</summary>
        <div className="mt-3">
          <ActionForm action={reportAction.bind(null, publicId)}>
            <SelectField
              name="reason"
              label={t("view.reportTitle")}
              options={REPORT_REASONS.map((r) => ({ value: r, label: t(`enums.ReportReason.${r}`) }))}
            />
            <TextArea name="details" label={t("contact.message")} rows={3} maxLength={2000} />
            <SubmitButton variant="secondary" size="sm">
              {t("common.submit")}
            </SubmitButton>
          </ActionForm>
        </div>
      </details>
      <details className="border-line rounded-xl border p-3">
        <summary className="text-danger-600 cursor-pointer text-sm font-medium">{t("view.block")}</summary>
        <div className="mt-3">
          <ActionForm action={blockAction.bind(null, publicId)}>
            <p className="text-muted text-sm">{t("view.blockConfirm")}</p>
            <SubmitButton variant="danger" size="sm">
              {t("view.block")}
            </SubmitButton>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
