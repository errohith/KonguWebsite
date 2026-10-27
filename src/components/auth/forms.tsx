"use client";

import Link from "next/link";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  return (
    <ActionForm action={loginAction}>
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField name="email" type="email" label={t("auth.email")} autoComplete="email" required />
      <TextField name="password" type="password" label={t("auth.password")} autoComplete="current-password" required />
      <div className="flex items-center justify-between">
        <SubmitButton>{t("auth.submitLogin")}</SubmitButton>
        <Link href="/forgot-password" className="text-maroon-700 text-sm underline">
          {t("auth.forgot")}
        </Link>
      </div>
    </ActionForm>
  );
}

export function RegisterForm() {
  const t = useT();
  return (
    <ActionForm action={registerAction}>
      <TextField name="email" type="email" label={t("auth.email")} autoComplete="email" required />
      <TextField
        name="password"
        type="password"
        label={t("auth.password")}
        hint={t("auth.passwordHint")}
        autoComplete="new-password"
        required
        minLength={10}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="dateOfBirth" type="date" label={t("auth.dateOfBirth")} hint={t("auth.dobHint")} required />
        <SelectField
          name="gender"
          label={t("auth.gender")}
          placeholder={t("common.select")}
          options={[
            { value: "MALE", label: t("enums.Gender.MALE") },
            { value: "FEMALE", label: t("enums.Gender.FEMALE") },
          ]}
          required
        />
      </div>
      <TextField
        name="phone"
        type="tel"
        label={t("auth.phone")}
        hint={t("auth.phoneHint")}
        autoComplete="tel"
        placeholder="+91"
      />
      <CheckboxField
        name="acceptTerms"
        label={
          <>
            {t("auth.acceptTerms")}{" "}
            <Link href="/terms" target="_blank" className="underline">
              {t("footer.terms")}
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" target="_blank" className="underline">
              {t("footer.privacy")}
            </Link>
          </>
        }
      />
      <SubmitButton size="lg" className="w-full">
        {t("auth.submitRegister")}
      </SubmitButton>
    </ActionForm>
  );
}

export function ForgotPasswordForm() {
  const t = useT();
  return (
    <ActionForm action={forgotPasswordAction}>
      <TextField name="email" type="email" label={t("auth.email")} autoComplete="email" required />
      <SubmitButton>{t("auth.sendReset")}</SubmitButton>
    </ActionForm>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  return (
    <ActionForm action={resetPasswordAction}>
      <input type="hidden" name="token" value={token} />
      <TextField
        name="password"
        type="password"
        label={t("auth.newPassword")}
        hint={t("auth.passwordHint")}
        autoComplete="new-password"
        required
      />
      <SubmitButton>{t("common.submit")}</SubmitButton>
    </ActionForm>
  );
}
