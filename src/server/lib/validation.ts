import { z } from "zod";

/** HTML checkbox / JSON boolean. Unlike z.coerce.boolean, "false" is false. */
export const checkbox = z
  .union([z.boolean(), z.string(), z.null()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true" || v === "1");

/** Optional trimmed text; empty string becomes null (clears the field). */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const optionalInt = (min: number, max: number) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: "errors.outOfRange" });
        return z.NEVER;
      }
      return n;
    });

export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? (v as T[number]) : null));

/** Multi-select: accepts string | string[] (FormData.getAll) of enum values. */
export const enumArray = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.array(z.enum(values)), z.enum(values)])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]));

export const stringArray = (maxItems: number, maxLen: number) =>
  z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) =>
      (v === undefined ? [] : Array.isArray(v) ? v : v.split(","))
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, maxItems)
        .map((s) => s.slice(0, maxLen)),
    );
