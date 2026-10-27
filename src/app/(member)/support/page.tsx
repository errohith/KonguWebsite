import type { Metadata } from "next";
import Link from "next/link";
import { TicketForm } from "@/components/support/ticket-form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/modules/auth/current";
import { listOwnTickets } from "@/server/modules/support/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("support.title") };
}

export default async function SupportPage() {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const tickets = await listOwnTickets(user.id);
  return (
    <>
      <PageHeader title={t("support.title")} />
      <Card>
        <h2 className="text-maroon-800 mb-4 text-lg font-semibold">{t("support.myTickets")}</h2>
        {tickets.length === 0 ? (
          <EmptyState>{t("support.none")}</EmptyState>
        ) : (
          <ul className="divide-line divide-y">
            {tickets.map((tk) => (
              <li key={tk.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/support/${tk.id}`} className="text-maroon-700 font-medium hover:underline">
                  {tk.subject}
                </Link>
                <Badge>{tk.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="text-maroon-800 mb-4 text-lg font-semibold">{t("support.newTicket")}</h2>
        <TicketForm defaultEmail={user.email} />
      </Card>
    </>
  );
}
