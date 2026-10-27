import Link from "next/link";
import { getLocale, getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";
import { logoutAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/modules/auth/current";
import { hasPermission } from "@/server/modules/auth/permissions";
import { unreadCount } from "@/server/modules/notifications/service";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/card";
import { LanguageSwitch } from "./language-switch";
import { Logo } from "./logo";

export async function Header() {
  const [t, locale, user] = await Promise.all([getT(), getLocale(), getCurrentUser()]);
  const unread = user ? await unreadCount(user.id) : 0;

  const publicLinks = [
    { href: "/about", label: t("nav.about") },
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/membership", label: t("nav.membership") },
    { href: "/safety", label: t("nav.safety") },
    { href: "/contact", label: t("nav.contact") },
  ];
  const memberLinks = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/search", label: t("nav.search") },
    { href: "/matches", label: t("nav.matches") },
    { href: "/interests", label: t("nav.interests") },
    { href: "/shortlist", label: t("nav.shortlist") },
  ];
  const links = user ? memberLinks : publicLinks;

  return (
    <header className="border-line bg-ivory/90 sticky top-0 z-30 border-b backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo name={getEnv().APP_NAME} />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-ink hover:bg-sand rounded-full px-3 py-2 text-sm">
              {l.label}
            </Link>
          ))}
          {user && hasPermission(user.role, "admin.access") && (
            <Link href="/admin" className="text-gold-700 hover:bg-sand rounded-full px-3 py-2 text-sm font-medium">
              {t("nav.admin")}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitch locale={locale} label={t("nav.language")} />
          {user ? (
            <>
              <Link
                href="/notifications"
                className="hover:bg-sand relative hidden rounded-full p-2 sm:block"
                aria-label={t("nav.notifications")}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unread > 0 && (
                  <span className="bg-maroon-700 absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <form action={logoutAction} className="hidden sm:block">
                <button className={buttonClass("secondary", "sm")}>{t("nav.logout")}</button>
              </form>
            </>
          ) : (
            <>
              <span className="hidden sm:block">
                <Link href="/login" className={buttonClass("ghost", "sm")}>
                  {t("nav.login")}
                </Link>
              </span>
              <Link href="/register" className={buttonClass("primary", "sm")}>
                {t("nav.register")}
              </Link>
            </>
          )}
          <details className="relative lg:hidden">
            <summary
              className="hover:bg-sand list-none rounded-full p-2 [&::-webkit-details-marker]:hidden"
              aria-label={t("nav.menu")}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <div className="border-line absolute right-0 mt-2 w-60 rounded-2xl border bg-white p-2 shadow-lg">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="hover:bg-sand block rounded-xl px-3 py-2 text-sm">
                  {l.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link href="/profile/edit/basic" className="hover:bg-sand block rounded-xl px-3 py-2 text-sm">
                    {t("nav.myProfile")}
                  </Link>
                  <Link href="/notifications" className="hover:bg-sand block rounded-xl px-3 py-2 text-sm">
                    {t("nav.notifications")}
                  </Link>
                  <Link href="/settings" className="hover:bg-sand block rounded-xl px-3 py-2 text-sm">
                    {t("nav.settings")}
                  </Link>
                  {hasPermission(user.role, "admin.access") && (
                    <Link href="/admin" className="text-gold-700 hover:bg-sand block rounded-xl px-3 py-2 text-sm">
                      {t("nav.admin")}
                    </Link>
                  )}
                  <form action={logoutAction}>
                    <button className="hover:bg-sand block w-full rounded-xl px-3 py-2 text-left text-sm">
                      {t("nav.logout")}
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="hover:bg-sand block rounded-xl px-3 py-2 text-sm">
                  {t("nav.login")}
                </Link>
              )}
            </div>
          </details>
        </div>
      </Container>
    </header>
  );
}
