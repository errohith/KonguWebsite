import { setLocaleAction } from "@/server/actions/auth";
import type { Locale } from "@/i18n/config";

export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLocaleAction}>
      <input type="hidden" name="locale" value={locale === "en" ? "ta" : "en"} />
      <button
        type="submit"
        className="border-line text-maroon-700 hover:bg-maroon-50 rounded-full border bg-white px-3 py-1.5 text-sm font-medium"
        lang={locale === "en" ? "ta" : "en"}
      >
        {label}
      </button>
    </form>
  );
}
