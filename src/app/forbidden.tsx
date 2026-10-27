import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/card";
import { getT } from "@/i18n/server";

export default async function Forbidden() {
  const t = await getT();
  return (
    <Container className="py-24 text-center">
      <p className="font-display text-gold-500 text-6xl">403</p>
      <h1 className="text-maroon-800 mt-4 text-2xl font-semibold">{t("common.forbidden")}</h1>
      <Link href="/dashboard" className={buttonClass("primary", "md", "mt-8")}>
        {t("nav.dashboard")}
      </Link>
    </Container>
  );
}
