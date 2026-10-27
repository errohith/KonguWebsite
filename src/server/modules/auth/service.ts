import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { VerificationTokenType } from "@/generated/prisma/enums";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { track } from "@/server/integrations/analytics";
import { getSmsProvider } from "@/server/integrations/sms";
import { hashToken, randomNumericCode, randomToken, sha256 } from "@/server/lib/crypto";
import { ageOn } from "@/server/lib/dates";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { sendTemplatedEmail } from "@/server/modules/notifications/email";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import { changePasswordSchema, loginSchema, registerSchema, resetPasswordSchema, type RegisterInput } from "./schemas";
import { createSession, revokeAllSessions, SESSION_STATUSES } from "./sessions";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const TOKEN_TTL_MINUTES: Record<VerificationTokenType, number> = {
  EMAIL_VERIFY: 24 * 60,
  PASSWORD_RESET: 30,
  PHONE_OTP: 10,
};
const MAX_OTP_ATTEMPTS = 5;

export function minimumAge(gender: "MALE" | "FEMALE"): number {
  const env = getEnv();
  return gender === "MALE" ? env.MIN_AGE_MALE : env.MIN_AGE_FEMALE;
}

async function issueToken(userId: string, type: VerificationTokenType, value: string) {
  // Only the newest token of a type is valid.
  await db.verificationToken.deleteMany({ where: { userId, type, consumedAt: null } });
  await db.verificationToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(type === "PHONE_OTP" ? `${userId}:${value}` : value),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES[type] * 60_000),
    },
  });
}

/** Atomically consumes a link token; returns the owning user id. */
async function consumeLinkToken(type: VerificationTokenType, token: string) {
  const record = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.consumedAt || record.expiresAt < new Date()) {
    throw new AppError("INVALID_TOKEN");
  }
  const { count } = await db.verificationToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count !== 1) throw new AppError("INVALID_TOKEN");
  return record.userId;
}

async function sendVerificationEmail(user: { id: string; email: string; locale: "en" | "ta" }) {
  const token = randomToken(32);
  await issueToken(user.id, "EMAIL_VERIFY", token);
  const url = `${getEnv().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendTemplatedEmail(user.email, user.locale, "verifyEmail", { url });
}

export async function register(raw: RegisterInput | Record<string, unknown>, meta: { ip?: string } = {}) {
  const input = registerSchema.parse(raw);
  const env = getEnv();
  await enforceRateLimit(`register:${meta.ip ?? "unknown"}`, 10, 3600);

  if (ageOn(input.dateOfBirth) < minimumAge(input.gender)) {
    throw new AppError("UNDERAGE", undefined, { minimumAge: minimumAge(input.gender) });
  }

  const requireVerification = env.ENABLE_EMAIL_VERIFICATION;
  let user;
  try {
    user = await db.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        locale: input.locale,
        termsAcceptedAt: new Date(),
        status: requireVerification ? "PENDING_VERIFICATION" : "ACTIVE",
        emailVerifiedAt: requireVerification ? null : new Date(),
      },
      select: { id: true, email: true, locale: true, status: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("CONFLICT", "errors.accountExists");
    }
    throw err;
  }

  let verificationEmailSent = false;
  if (requireVerification) {
    try {
      await sendVerificationEmail(user);
      verificationEmailSent = true;
    } catch (err) {
      // Registration succeeds; the member can resend from the dashboard.
      logger.warn("auth.verification_email_failed", { userId: user.id, error: err });
    }
  }
  track("user_registered", { gender: input.gender });
  return { user, verificationEmailSent };
}

export async function login(
  raw: { email: string; password: string },
  meta: { ip?: string; userAgent?: string | null } = {},
) {
  const input = loginSchema.parse(raw);
  await enforceRateLimit(`login:ip:${meta.ip ?? "unknown"}`, 30, 900);
  await enforceRateLimit(`login:email:${sha256(input.email)}`, 10, 900);

  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await burnPasswordCheck(input.password);
    throw new AppError("INVALID_CREDENTIALS");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new AppError("ACCOUNT_LOCKED");

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : undefined,
      },
    });
    throw new AppError("INVALID_CREDENTIALS");
  }
  if (!SESSION_STATUSES.has(user.status)) throw new AppError("ACCOUNT_INACTIVE");

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  const session = await createSession(user.id, meta.userAgent);
  return { user: { id: user.id, role: user.role, status: user.status }, ...session };
}

export async function resendVerificationEmail(userId: string) {
  await enforceRateLimit(`verify-resend:${userId}`, 3, 3600);
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, locale: true, emailVerifiedAt: true },
  });
  if (user.emailVerifiedAt) return { alreadyVerified: true };
  await sendVerificationEmail(user);
  return { alreadyVerified: false };
}

export async function verifyEmail(token: string) {
  const userId = await consumeLinkToken("EMAIL_VERIFY", token);
  await db.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  await db.user.updateMany({
    where: { id: userId, status: "PENDING_VERIFICATION" },
    data: { status: "ACTIVE" },
  });
  return { userId };
}

/** Always resolves the same way whether or not the email exists (no enumeration). */
export async function requestPasswordReset(email: string, meta: { ip?: string } = {}) {
  const normalized = email.trim().toLowerCase();
  await enforceRateLimit(`pwreset:ip:${meta.ip ?? "unknown"}`, 10, 3600);
  await enforceRateLimit(`pwreset:email:${sha256(normalized)}`, 3, 3600);
  const user = await db.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, locale: true, status: true },
  });
  if (!user || !SESSION_STATUSES.has(user.status)) return;
  const token = randomToken(32);
  await issueToken(user.id, "PASSWORD_RESET", token);
  const url = `${getEnv().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendTemplatedEmail(user.email, user.locale, "passwordReset", { url });
  } catch (err) {
    logger.error("auth.password_reset_email_failed", { userId: user.id, error: err });
    throw new AppError("SERVICE_UNAVAILABLE");
  }
}

export async function resetPassword(raw: { token: string; password: string }) {
  const input = resetPasswordSchema.parse(raw);
  const userId = await consumeLinkToken("PASSWORD_RESET", input.token);
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(input.password),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await revokeAllSessions(userId);
}

export async function changePassword(
  userId: string,
  raw: { currentPassword: string; newPassword: string },
  currentSessionToken?: string,
) {
  const input = changePasswordSchema.parse(raw);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError("INVALID_CREDENTIALS");
  }
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  await revokeAllSessions(userId, currentSessionToken ? sha256(currentSessionToken) : undefined);
}

export async function requestPhoneOtp(userId: string) {
  if (!getEnv().ENABLE_SMS_VERIFICATION) throw new AppError("FEATURE_DISABLED");
  await enforceRateLimit(`otp:${userId}`, 5, 3600);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
  if (!user.phone) throw new AppError("VALIDATION", "errors.phoneRequired");
  const code = randomNumericCode(6);
  await issueToken(userId, "PHONE_OTP", code);
  await getSmsProvider().send(user.phone, `Your Kongu Matrimony verification code is ${code}`);
}

export async function verifyPhoneOtp(userId: string, code: string) {
  if (!getEnv().ENABLE_SMS_VERIFICATION) throw new AppError("FEATURE_DISABLED");
  const record = await db.verificationToken.findFirst({
    where: { userId, type: "PHONE_OTP", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= MAX_OTP_ATTEMPTS) throw new AppError("INVALID_TOKEN");
  if (record.tokenHash !== hashToken(`${userId}:${code}`)) {
    await db.verificationToken.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError("INVALID_TOKEN");
  }
  await db.$transaction([
    db.verificationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    db.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } }),
  ]);
}
