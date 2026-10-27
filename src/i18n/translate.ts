import en, { type Messages } from "./messages/en";
import ta from "./messages/ta";
import type { Locale } from "./config";

export const MESSAGES: Record<Locale, Messages> = { en, ta };

export type TranslateVars = Record<string, string | number>;
export type Translator = ((key: string, vars?: TranslateVars) => string) & {
  list: (key: string) => readonly string[];
  locale: Locale;
};

function lookup(messages: Messages, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
      messages,
    );
}

/**
 * Dot-path translator with {placeholder} interpolation. Falls back to
 * English, then to the key itself, so a missing string is visible but harmless.
 */
export function createTranslator(locale: Locale): Translator {
  const fn = ((key: string, vars?: TranslateVars) => {
    let value = lookup(MESSAGES[locale], key);
    if (typeof value !== "string") value = lookup(MESSAGES.en, key);
    if (typeof value !== "string") return key;
    return vars ? value.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : value;
  }) as Translator;
  fn.list = (key: string) => {
    const value = lookup(MESSAGES[locale], key);
    return Array.isArray(value) ? value : [];
  };
  fn.locale = locale;
  return fn;
}

/** Maps a service error message (e.g. "errors.invalidEmail" or "VALIDATION") to text. */
export function translateError(t: Translator, code: string | undefined, vars?: TranslateVars): string {
  if (!code) return t("errors.generic");
  const key = code.startsWith("errors.") ? code : `errors.${code}`;
  const text = t(key, vars);
  return text === key ? t("errors.generic") : text;
}
