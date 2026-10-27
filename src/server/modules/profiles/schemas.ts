import { z } from "zod";
import {
  CREATED_FOR,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  FAMILY_STATUSES,
  FAMILY_TYPES,
  MARITAL_STATUSES,
  PHOTO_VISIBILITIES,
  PROFILE_VISIBILITIES,
  RESIDENCY_STATUSES,
} from "@/lib/options";
import { checkbox, enumArray, optionalEnum, optionalInt, optionalText, stringArray } from "@/server/lib/validation";

export const PROFILE_STEPS = [
  "basic",
  "career",
  "location",
  "family",
  "horoscope",
  "contact",
  "preferences",
  "photos",
  "privacy",
] as const;
export type ProfileStep = (typeof PROFILE_STEPS)[number];

export const basicSchema = z.object({
  createdFor: z.enum(CREATED_FOR),
  displayName: z.string().trim().min(2, "errors.required").max(60),
  maritalStatus: z.enum(MARITAL_STATUSES),
  heightCm: optionalInt(100, 250),
  motherTongue: optionalText(40),
  religion: optionalText(40),
  community: optionalText(60),
  kootam: optionalText(40),
  aboutMe: optionalText(2000),
});

export const careerSchema = z.object({
  highestEducation: z.enum(EDUCATION_LEVELS, { message: "errors.required" }),
  educationDetail: optionalText(120),
  occupation: z.string().trim().min(2, "errors.required").max(80),
  employmentType: optionalEnum(EMPLOYMENT_TYPES),
  annualIncomeInr: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^\d{1,10}(\.\d{1,2})?$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "errors.invalidAmount" });
        return z.NEVER;
      }
      return v;
    }),
});

export const locationSchema = z.object({
  nativePlace: optionalText(80),
  nativeDistrict: optionalText(60),
  currentCity: z.string().trim().min(2, "errors.required").max(80),
  currentState: optionalText(60),
  currentCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "errors.required"),
  residencyStatus: optionalEnum(RESIDENCY_STATUSES),
});

export const familySchema = z.object({
  fatherOccupation: optionalText(80),
  motherOccupation: optionalText(80),
  siblingsSummary: optionalText(200),
  familyType: optionalEnum(FAMILY_TYPES),
  familyStatus: optionalEnum(FAMILY_STATUSES),
  familyDetails: optionalText(1000),
});

export const horoscopeSchema = z.object({
  rasi: optionalText(30),
  nakshatram: optionalText(30),
  lagnam: optionalText(30),
  dosham: optionalText(60),
  birthTime: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "errors.invalidTime" });
        return z.NEVER;
      }
      return v;
    }),
  birthPlace: optionalText(80),
});

export const contactSchema = z
  .object({
    contactName: optionalText(60),
    contactPhone: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        if (!/^\+[1-9]\d{7,14}$/.test(v)) {
          ctx.addIssue({ code: "custom", message: "errors.invalidPhone" });
          return z.NEVER;
        }
        return v;
      }),
    contactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        if (!z.email().safeParse(v).success) {
          ctx.addIssue({ code: "custom", message: "errors.invalidEmail" });
          return z.NEVER;
        }
        return v;
      }),
    relationship: optionalText(40),
  })
  .refine((v) => v.contactPhone || v.contactEmail, {
    message: "errors.contactRequired",
    path: ["contactPhone"],
  });

export const preferencesSchema = z
  .object({
    ageMin: optionalInt(18, 80),
    ageMax: optionalInt(18, 80),
    heightMinCm: optionalInt(100, 250),
    heightMaxCm: optionalInt(100, 250),
    maritalStatuses: enumArray(MARITAL_STATUSES),
    educationLevels: enumArray(EDUCATION_LEVELS),
    employmentTypes: enumArray(EMPLOYMENT_TYPES),
    countries: stringArray(20, 2).transform((a) => a.map((c) => c.toUpperCase())),
    states: stringArray(20, 60),
    excludeSameKootam: checkbox,
    aboutPartner: optionalText(1000),
  })
  .refine((v) => v.ageMin === null || v.ageMax === null || v.ageMin <= v.ageMax, {
    message: "errors.invalidRange",
    path: ["ageMax"],
  })
  .refine((v) => v.heightMinCm === null || v.heightMaxCm === null || v.heightMinCm <= v.heightMaxCm, {
    message: "errors.invalidRange",
    path: ["heightMaxCm"],
  });

export const privacySchema = z.object({
  visibility: z.enum(PROFILE_VISIBILITIES),
  photoVisibility: z.enum(PHOTO_VISIBILITIES),
});
