import type { Metadata } from "next";
import { ProfileCard } from "@/components/profile/profile-card";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requireActiveMember } from "@/server/modules/auth/current";
import { listShortlist } from "@/server/modules/interests/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("shortlist.title") };
}

export default async function ShortlistPage() {
  const [user, t] = await Promise.all([requireActiveMember(), getT()]);
  const cards = await listShortlist(user);
  return (
    <>
      <PageHeader title={t("shortlist.title")} />
      {cards.length === 0 ? (
        <EmptyState>{t("shortlist.none")}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <ProfileCard key={card.publicId} card={card} t={t} />
          ))}
        </div>
      )}
    </>
  );
}
