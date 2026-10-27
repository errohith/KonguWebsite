import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { createTranslator } from "./translate";

/** Locale from the preference cookie, else the browser's Accept-Language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  return /(^|,)\s*ta\b/i.test(accept) ? "ta" : DEFAULT_LOCALE;
});

export async function getT() {
  return createTranslator(await getLocale());
}
