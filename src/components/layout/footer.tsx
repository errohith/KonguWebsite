import Link from "next/link";
import { getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";
import { Container } from "@/components/ui/card";

export async function Footer() {
  const t = await getT();
  const env = getEnv();
  const links = [
    ["/about", t("nav.about")],
    ["/how-it-works", t("nav.howItWorks")],
    ["/membership", t("nav.membership")],
    ["/faq", t("nav.faq")],
    ["/safety", t("nav.safety")],
    ["/contact", t("nav.contact")],
    ["/privacy", t("footer.privacy")],
    ["/terms", t("footer.terms")],
  ];
  return (
    <footer className="border-line bg-maroon-800 text-maroon-50 mt-16 border-t">
      <div className="kolam-divider" />
      <Container className="grid gap-8 py-10 sm:grid-cols-2">
        <div>
          <p className="font-display text-xl font-semibold text-white">{env.APP_NAME}</p>
          <p className="text-maroon-100 mt-2 max-w-sm text-sm">{t("footer.community")}</p>
        </div>
        <nav className="grid grid-cols-2 gap-2 text-sm" aria-label="Footer">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="text-maroon-100 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
      </Container>
      <Container className="text-maroon-100 border-t border-white/10 py-4 text-xs">
        © {new Date().getUTCFullYear()} {env.APP_NAME}. {t("footer.rights")}
      </Container>
    </footer>
  );
}
