import Link from "next/link";
import { Alert, Container } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/modules/auth/current";
import { touchLastActive } from "@/server/modules/profiles/service";
import { ResendVerification } from "@/components/member/resend-verification";

export default async function MemberLayout({ children }: LayoutProps<"/">) {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  await touchLastActive(user.id);
  const side = [
    ["/dashboard", t("nav.dashboard")],
    ["/profile/edit/basic", t("nav.myProfile")],
    ["/search", t("nav.search")],
    ["/matches", t("nav.matches")],
    ["/interests", t("nav.interests")],
    ["/shortlist", t("nav.shortlist")],
    ["/membership", t("nav.membership")],
    ["/verification", t("verification.title")],
    ["/notifications", t("nav.notifications")],
    ["/support", t("nav.support")],
    ["/settings", t("nav.settings")],
  ];
  return (
    <Container className="grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1" aria-label="Member">
          {side.map(([href, label]) => (
            <Link key={href} href={href} className="text-ink hover:bg-sand block rounded-xl px-3 py-2 text-sm">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 space-y-4">
        {user.status === "PENDING_VERIFICATION" && (
          <Alert>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{t("auth.verifyBanner")}</span>
              <ResendVerification />
            </div>
          </Alert>
        )}
        {(user.status === "DEACTIVATED" || user.status === "DELETION_REQUESTED") && (
          <Alert tone="error">
            {t("settings.inactiveBanner")}{" "}
            <Link href="/settings" className="underline">
              {t("nav.settings")}
            </Link>
          </Alert>
        )}
        {children}
      </div>
    </Container>
  );
}
