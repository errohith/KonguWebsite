import { z } from "zod";
import { parseIsoDate } from "@/server/lib/dates";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("errors.invalidEmail").max(254));

export const passwordSchema = z
  .string()
  .min(10, "errors.passwordTooShort")
  .max(128, "errors.passwordTooLong")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "errors.passwordWeak");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "errors.invalidPhone");

export const isoDateSchema = z.string().transform((v, ctx) => {
  const d = parseIsoDate(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "errors.invalidDate" });
    return z.NEVER;
  }
  return d;
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  dateOfBirth: isoDateSchema,
  gender: z.enum(["MALE", "FEMALE"]),
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  acceptTerms: z.literal(true, { message: "errors.mustAcceptTerms" }),
  locale: z.enum(["en", "ta"]).default("en"),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
