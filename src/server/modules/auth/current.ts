import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { getEnv, isSecureCookie } from "@/server/config/env";
import { AppError } from "@/server/lib/errors";
import { hasPermission, type Permission } from "./permissions";
import { validateSessionToken, type SessionUser } from "./sessions";

/** Cookie + session helpers for Server Components and Server Actions. */

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(getEnv().SESSION_COOKIE_NAME)?.value;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(getEnv().SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(getEnv().SESSION_COOKIE_NAME);
}

/** Current signed-in user for this request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const result = await validateSessionToken(await getSessionToken());
  return result?.user ?? null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return user;
}

/** Signed-in, verified, and not deactivated — required for member features. */
export async function requireActiveMember(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.status === "PENDING_VERIFICATION") redirect("/dashboard?verify=1");
  if (user.status !== "ACTIVE") redirect("/settings?inactive=1");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) forbidden();
  return user;
}

/** Same checks for server actions, throwing AppError instead of redirecting. */
export async function assertActionUser(opts: { active?: boolean; permission?: Permission } = {}) {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  if (opts.active && user.status === "PENDING_VERIFICATION") throw new AppError("EMAIL_NOT_VERIFIED");
  if (opts.active && user.status !== "ACTIVE") throw new AppError("ACCOUNT_INACTIVE");
  if (opts.permission && !hasPermission(user.role, opts.permission)) throw new AppError("FORBIDDEN");
  return user;
}

export async function getClientMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
    userAgent: h.get("user-agent"),
  };
}
