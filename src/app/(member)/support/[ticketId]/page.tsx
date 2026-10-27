import { notFound } from "next/navigation";
import { ReplyForm } from "@/components/support/reply-form";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { isAppError } from "@/server/lib/errors";
import { requireUser } from "@/server/modules/auth/current";
import { getTicketForUser } from "@/server/modules/support/service";

export default async function TicketPage({ params }: PageProps<"/support/[ticketId]">) {
  const [{ ticketId }, user, t] = await Promise.all([params, requireUser(), getT()]);
  const ticket = await getTicketForUser(user.id, ticketId, false).catch((err) => {
    if (isAppError(err)) notFound();
    throw err;
  });
  return (
    <>
      <PageHeader title={ticket.subject} actions={<Badge>{ticket.status}</Badge>} />
      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <Card key={m.id} className={m.isStaff ? "border-gold-400 bg-gold-100/30" : ""}>
            <p className="text-muted mb-1 text-xs">
              {m.isStaff ? t("support.staff") : t("support.you")} ·{" "}
              {m.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
            </p>
            <p className="text-sm whitespace-pre-line">{m.body}</p>
          </Card>
        ))}
      </div>
      {ticket.status !== "CLOSED" && (
        <Card>
          <ReplyForm ticketId={ticket.id} />
        </Card>
      )}
    </>
  );
}
