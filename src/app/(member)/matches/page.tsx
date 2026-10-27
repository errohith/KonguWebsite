import type { Metadata } from "next";
import Link from "next/link";
import { NeedPublishedProfile } from "@/components/profile/need-profile";
import { Pagination, ProfileCard } from "@/components/profile/profile-card";
import { buttonClass } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requireActiveMember } from "@/server/modules/auth/current";
import { canDiscover } from "@/server/modules/discovery/guard";
import { matchesForViewer } from "@/server/modules/discovery/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("matches.title") };
}

export default async function MatchesPage({ searchParams }: PageProps<"/matches">) {
  const [user, t, sp] = await Promise.all([requireActiveMember(), getT(), searchParams]);
  if (!(await canDiscover(user.id))) {
    return (
      <>
        <PageHeader title={t("matches.title")} />
        <NeedPublishedProfile t={t} />
      </>
    );
  }
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await matchesForViewer(user, page);
  return (
    <>
      <PageHeader title={t("matches.title")} subtitle={t("matches.intro")} />
      {!result.hasPreferences && (
        <Alert>
          {t("matches.noPrefs")}{" "}
          <Link href="/profile/edit/preferences" className={buttonClass("ghost", "sm")}>
            {t("matches.setPrefs")}
          </Link>
        </Alert>
      )}
      {result.items.length === 0 ? (
        <EmptyState>{t("search.none")}</EmptyState>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((card) => (
              <ProfileCard key={card.publicId} card={card} t={t} />
            ))}
          </div>
          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(p) => `/matches?page=${p}`} t={t} />
        </>
      )}
    </>
  );
}
