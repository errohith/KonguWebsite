import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/card";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <Container className="py-24 text-center">
      <p className="font-display text-gold-500 text-6xl">404</p>
      <h1 className="text-maroon-800 mt-4 text-2xl font-semibold">{t("common.notFound")}</h1>
      <Link href="/" className={buttonClass("primary", "md", "mt-8")}>
        {t("common.goHome")}
      </Link>
    </Container>
  );
}
