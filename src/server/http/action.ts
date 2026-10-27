import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { captureException } from "@/server/integrations/error-tracking";
import { isAppError } from "@/server/lib/errors";
import { getT } from "@/i18n/server";
import { translateError, type Translator } from "@/i18n/translate";

import type { ActionState } from "@/lib/action-state";

export type { ActionState };

function fieldErrorsFrom(err: ZodError, t: Translator) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const field = String(issue.path[0] ?? "_");
    if (out[field]) continue;
    out[field] = issue.message.startsWith("errors.") ? translateError(t, issue.message) : t("errors.invalidValue");
  }
  return out;
}

/**
 * Runs a server action body and converts outcomes into ActionState:
 * - returned string → success message key (translated)
 * - ZodError → per-field messages
 * - AppError → translated error code/message
 * - anything else → logged, generic message (no internals leaked)
 * Next.js navigation signals (redirect/notFound) are re-thrown.
 */
export async function runAction(
  fn: () => Promise<string | void | { message?: string; data?: Record<string, unknown> }>,
): Promise<ActionState> {
  const t = await getT();
  try {
    const result = await fn();
    if (typeof result === "string") return { ok: true, message: t(result) };
    return { ok: true, message: result?.message ? t(result.message) : undefined, data: result?.data };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ZodError) {
      return { ok: false, error: t("errors.VALIDATION"), fieldErrors: fieldErrorsFrom(err, t) };
    }
    if (isAppError(err)) {
      const vars = err.details as Record<string, string | number> | undefined;
      const key = err.message !== err.code ? err.message : err.code;
      return { ok: false, error: translateError(t, key, vars) };
    }
    captureException(err, { where: "server_action" });
    return { ok: false, error: t("errors.generic") };
  }
}

/** FormData → plain object; repeated keys become arrays (multi-selects). */
export function formToObject(form: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = form.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = values.length > 1 ? values : (values[0] ?? "");
  }
  return out;
}
