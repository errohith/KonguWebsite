export const LOCALES = ["en", "ta"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
/** Non-sensitive preference cookie, readable by the server for SSR. */
export const LOCALE_COOKIE = "km_locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
