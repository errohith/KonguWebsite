import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { requirePermission } from "@/server/modules/auth/current";
import { listTicketsForStaff } from "@/server/modules/support/service";

export default async function AdminSupportPage({ searchParams }: PageProps<"/admin/support">) {
  await requirePermission("support.manage");
  const sp = await searchParams;
  const status = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(String(sp.status))
    ? (sp.status as "OPEN")
    : undefined;
  const tickets = await listTicketsForStaff(status);
  return (
    <>
      <PageHeader
        title="Support tickets"
        actions={
          <div className="flex gap-3 text-sm">
            {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
              <Link key={s} href={`?status=${s}`} className="underline">
                {s}
              </Link>
            ))}
          </div>
        }
      />
      {tickets.length === 0 ? (
        <EmptyState>No tickets.</EmptyState>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-line divide-y">
            {tickets.map((tk) => (
              <li key={tk.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/admin/support/${tk.id}`} className="text-maroon-700 font-medium hover:underline">
                  {tk.subject}
                </Link>
                <span className="text-muted">
                  {tk.email} · {tk.category} · {tk.assignedTo?.email ?? "unassigned"}
                </span>
                <Badge>{tk.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
