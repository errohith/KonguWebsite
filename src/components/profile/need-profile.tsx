import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import type { Translator } from "@/i18n/translate";

export function NeedPublishedProfile({ t }: { t: Translator }) {
  return (
    <EmptyState>
      <p>{t("search.needProfile")}</p>
      <Link href="/profile/edit/basic" className={buttonClass("primary", "md", "mt-4")}>
        {t("dashboard.continueProfile")}
      </Link>
    </EmptyState>
  );
}
