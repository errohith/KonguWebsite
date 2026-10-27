"use client";

import { useTransition } from "react";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { changePasswordAction } from "@/server/actions/auth";
import { deactivateAction, deleteAccountAction, reactivateAction, unblockAction } from "@/server/actions/members";

export function ChangePasswordForm() {
  const t = useT();
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess>
      <TextField
        name="currentPassword"
        type="password"
        label={t("settings.currentPassword")}
        autoComplete="current-password"
      />
      <TextField
        name="newPassword"
        type="password"
        label={t("auth.newPassword")}
        hint={t("auth.passwordHint")}
        autoComplete="new-password"
      />
      <SubmitButton>{t("settings.changePassword")}</SubmitButton>
    </ActionForm>
  );
}

export function DeactivateForm() {
  const t = useT();
  return (
    <ActionForm action={deactivateAction}>
      <TextField
        name="password"
        type="password"
        label={t("settings.confirmPassword")}
        autoComplete="current-password"
      />
      <SubmitButton variant="secondary">{t("settings.deactivateButton")}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteAccountForm() {
  const t = useT();
  return (
    <ActionForm action={deleteAccountAction}>
      <TextField
        name="password"
        type="password"
        label={t("settings.confirmPassword")}
        autoComplete="current-password"
      />
      <SubmitButton variant="danger">{t("settings.deleteButton")}</SubmitButton>
    </ActionForm>
  );
}

export function ReactivateButton() {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => reactivateAction())}
      className="bg-maroon-700 rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {t("settings.reactivateButton")}
    </button>
  );
}

export function UnblockButton({ blockId }: { blockId: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => unblockAction(blockId))}
      className="text-maroon-700 text-sm underline"
    >
      {t("settings.unblock")}
    </button>
  );
}
