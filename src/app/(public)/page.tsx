import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Alert, Card, Container } from "@/components/ui/card";
import { getLocale, getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/modules/auth/current";
import { getContent } from "@/server/modules/content/service";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const [t, locale, user, sp] = await Promise.all([getT(), getLocale(), getCurrentUser(), searchParams]);
  const announcement = await getContent("home.announcement", locale);
  const trust = [1, 2, 3, 4].map((i) => ({ title: t(`home.trust${i}Title`), body: t(`home.trust${i}Body`) }));

  return (
    <>
      <section className="hero-bg overflow-hidden">
        <Container className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
          <div>
            {sp.deleted && (
              <div className="mb-4">
                <Alert>{t("settings.deletionRequested")}</Alert>
              </div>
            )}
            {announcement?.body && (
              <div className="mb-6">
                <Alert>{announcement.body}</Alert>
              </div>
            )}
            <p className="text-gold-700 mb-3 text-sm font-semibold tracking-widest uppercase">{t("meta.tagline")}</p>
            <h1 className="text-maroon-800 text-4xl leading-tight font-semibold sm:text-5xl">{t("home.heroTitle")}</h1>
            <p className="text-muted mt-5 max-w-xl text-lg">{t("home.heroSubtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/register"} className={buttonClass("primary", "lg")}>
                {user ? t("nav.dashboard") : t("home.ctaRegister")}
              </Link>
              <Link href={user ? "/search" : "/how-it-works"} className={buttonClass("secondary", "lg")}>
                {user ? t("home.ctaSearch") : t("nav.howItWorks")}
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="bg-gold-100 absolute -inset-3 rotate-3 rounded-[2rem]" aria-hidden />
            <Card className="relative rounded-[2rem] p-8">
              <p className="font-display text-maroon-800 text-2xl">{t("home.stepsTitle")}</p>
              <ol className="mt-6 space-y-5">
                {[t("home.step1"), t("home.step2"), t("home.step3")].map((s, i) => (
                  <li key={s} className="flex gap-4">
                    <span className="bg-maroon-700 grid size-9 shrink-0 place-items-center rounded-full font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="pt-1.5">{s}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </Container>
      </section>
      <div className="kolam-divider" />
      <Container className="py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map((item) => (
            <Card key={item.title}>
              <h2 className="text-maroon-800 text-lg font-semibold">{item.title}</h2>
              <p className="text-muted mt-2 text-sm">{item.body}</p>
            </Card>
          ))}
        </div>
      </Container>
      {!user && (
        <Container className="pb-8">
          <div className="bg-maroon-700 rounded-3xl px-6 py-12 text-center text-white sm:px-12">
            <h2 className="text-3xl font-semibold">{t("home.ctaBottomTitle")}</h2>
            <p className="text-maroon-100 mx-auto mt-3 max-w-xl">{t("home.ctaBottomBody")}</p>
            <Link href="/register" className={buttonClass("gold", "lg", "mt-6")}>
              {t("home.ctaRegister")}
            </Link>
          </div>
        </Container>
      )}
    </>
  );
}
