import type { Metadata } from "next";
import Link from "next/link";
import { ReceivedActions, SentActions } from "@/components/profile/interest-row-actions";
import { ProfileCard } from "@/components/profile/profile-card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requireActiveMember } from "@/server/modules/auth/current";
import { listInterests } from "@/server/modules/interests/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("interests.title") };
}

export default async function InterestsPage({ searchParams }: PageProps<"/interests">) {
  const [user, t, sp] = await Promise.all([requireActiveMember(), getT(), searchParams]);
  const tab = sp.tab === "sent" ? "sent" : "received";
  const items = await listInterests(user, tab);
  const tabCls = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm ${active ? "bg-maroon-700 text-white" : "bg-white hover:bg-sand"}`;
  return (
    <>
      <PageHeader title={t("interests.title")} />
      <div className="mb-6 flex gap-2">
        <Link href="/interests?tab=received" className={tabCls(tab === "received")}>
          {t("interests.received")}
        </Link>
        <Link href="/interests?tab=sent" className={tabCls(tab === "sent")}>
          {t("interests.sent")}
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState>{t("interests.none")}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => {
            const footer = (
              <div className="space-y-2">
                <div className="text-muted flex items-center justify-between gap-2 text-xs">
                  <span>
                    {tab === "received"
                      ? t("interests.from", { id: i.otherPublicId })
                      : t("interests.to", { id: i.otherPublicId })}
                  </span>
                  <Badge tone={i.status === "ACCEPTED" ? "green" : i.status === "PENDING" ? "gold" : "neutral"}>
                    {t(`enums.InterestStatus.${i.status}`)}
                  </Badge>
                </div>
                {i.message && <p className="text-sm italic">“{i.message}”</p>}
                {tab === "received" && i.status === "PENDING" && <ReceivedActions id={i.id} />}
                {tab === "sent" && i.status === "PENDING" && <SentActions id={i.id} />}
              </div>
            );
            return i.card ? (
              <ProfileCard key={i.id} card={i.card} t={t} footer={footer} />
            ) : (
              <div key={i.id} className="border-line rounded-2xl border bg-white p-4">
                <p className="text-muted mb-3 text-sm">{t("interests.unavailable")}</p>
                {footer}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
