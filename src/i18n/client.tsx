"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { createTranslator, type Translator } from "./translate";

const I18nContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext value={locale}>{children}</I18nContext>;
}

export function useT(): Translator {
  const locale = useContext(I18nContext);
  return useMemo(() => createTranslator(locale), [locale]);
}
