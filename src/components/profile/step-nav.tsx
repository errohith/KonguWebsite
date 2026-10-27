import Link from "next/link";
import type { Translator } from "@/i18n/translate";

export function StepNav({ steps, current, t }: { steps: readonly string[]; current: string; t: Translator }) {
  return (
    <nav aria-label={t("profile.wizardTitle")} className="-mx-1 flex gap-1 overflow-x-auto pb-2">
      {steps.map((s, i) => (
        <Link
          key={s}
          href={`/profile/edit/${s}`}
          aria-current={s === current ? "step" : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${s === current ? "bg-maroon-700 text-white" : "text-ink hover:bg-sand bg-white"}`}
        >
          {i + 1}. {t(`profile.steps.${s}`)}
        </Link>
      ))}
    </nav>
  );
}
