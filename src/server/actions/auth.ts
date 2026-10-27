"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import type { ActionState } from "@/lib/action-state";
import { db } from "@/server/db/client";
import { formToObject, runAction } from "@/server/http/action";
import { AppError } from "@/server/lib/errors";
import {
  clearSessionCookie,
  getClientMeta,
  getCurrentUser,
  getSessionToken,
  setSessionCookie,
} from "@/server/modules/auth/current";
import * as auth from "@/server/modules/auth/service";
import { revokeSessionToken } from "@/server/modules/auth/sessions";

/** Only same-site relative paths are accepted as post-login destinations. */
function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/dashboard";
}

export async function registerAction(_: ActionState, form: FormData): Promise<ActionState> {
  let target: string | null = null;
  const state = await runAction(async () => {
    const meta = await getClientMeta();
    const raw = formToObject(form);
    const { verificationEmailSent } = await auth.register(
      { ...raw, acceptTerms: raw.acceptTerms === "on", locale: await getLocale() },
      meta,
    );
    const session = await auth.login({ email: String(raw.email), password: String(raw.password) }, meta);
    await setSessionCookie(session.token, session.expiresAt);
    target = `/dashboard?welcome=1${verificationEmailSent ? "" : "&emailFailed=1"}`;
  });
  if (target) redirect(target);
  return state;
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  let target: string | null = null;
  const state = await runAction(async () => {
    const session = await auth.login(
      { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") },
      await getClientMeta(),
    );
    await setSessionCookie(session.token, session.expiresAt);
    target = session.user.role === "MEMBER" ? safeNext(form.get("next")) : safeNext(form.get("next") ?? "/admin");
  });
  if (target) redirect(target);
  return state;
}

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) await revokeSessionToken(token);
  await clearSessionCookie();
  redirect("/");
}

export async function forgotPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await auth.requestPasswordReset(String(form.get("email") ?? ""), await getClientMeta());
    return "auth.resetSent";
  });
}

export async function resetPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  let done = false;
  const state = await runAction(async () => {
    await auth.resetPassword({ token: String(form.get("token") ?? ""), password: String(form.get("password") ?? "") });
    done = true;
  });
  if (done) redirect("/login?reset=1");
  return state;
}

export async function resendVerificationAction(_: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    await auth.resendVerificationEmail(user.id);
    return "auth.resent";
  });
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    await auth.changePassword(
      user.id,
      {
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword: String(form.get("newPassword") ?? ""),
      },
      await getSessionToken(),
    );
    return "settings.passwordChanged";
  });
}

export async function setLocaleAction(form: FormData) {
  const locale = form.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { locale } });
  refresh();
}
