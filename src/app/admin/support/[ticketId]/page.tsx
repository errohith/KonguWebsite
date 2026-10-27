import { notFound } from "next/navigation";
import { SelectAction } from "@/components/admin/forms";
import { ReplyForm } from "@/components/support/reply-form";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { setTicketStatusAction } from "@/server/actions/admin";
import { isAppError } from "@/server/lib/errors";
import { requirePermission } from "@/server/modules/auth/current";
import { getTicketForUser } from "@/server/modules/support/service";

export default async function AdminTicketPage({ params }: PageProps<"/admin/support/[ticketId]">) {
  const user = await requirePermission("support.manage");
  const { ticketId } = await params;
  const ticket = await getTicketForUser(user.id, ticketId, true).catch((err) => {
    if (isAppError(err)) notFound();
    throw err;
  });
  return (
    <>
      <PageHeader
        title={ticket.subject}
        subtitle={`${ticket.name} <${ticket.email}> · ${ticket.category}`}
        actions={<Badge>{ticket.status}</Badge>}
      />
      <SelectAction
        action={setTicketStatusAction.bind(null, ticket.id)}
        name="status"
        options={["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]}
        defaultValue={ticket.status}
        label="Update status"
      />
      {ticket.messages.map((m) => (
        <Card key={m.id} className={m.isStaff ? "border-gold-400 bg-gold-100/30" : ""}>
          <p className="text-muted mb-1 text-xs">
            {m.isStaff ? "Staff" : "Member"} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
          </p>
          <p className="text-sm whitespace-pre-line">{m.body}</p>
        </Card>
      ))}
      {ticket.status !== "CLOSED" && (
        <Card>
          <ReplyForm ticketId={ticket.id} />
        </Card>
      )}
    </>
  );
}
