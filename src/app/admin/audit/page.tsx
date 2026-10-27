import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/card";
import { requirePermission } from "@/server/modules/auth/current";
import { listAuditLogs } from "@/server/modules/admin/service";

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const logs = await listAuditLogs(page);
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Administrative actions, newest first. Entries cannot be edited from the application."
      />
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand text-muted text-xs uppercase">
            <tr>
              <th className="p-3">Time (UTC)</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="p-3 whitespace-nowrap">{l.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                <td className="p-3">{l.actor?.email ?? "system"}</td>
                <td className="p-3 font-mono text-xs">{l.action}</td>
                <td className="p-3 font-mono text-xs">
                  {l.entityType}:{l.entityId?.slice(0, 8)}
                </td>
                <td className="max-w-xs truncate p-3 font-mono text-xs">
                  {l.metadata ? JSON.stringify(l.metadata) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="flex gap-3 text-sm">
        {page > 1 && (
          <Link className="underline" href={`?page=${page - 1}`}>
            Newer
          </Link>
        )}
        {logs.length === 50 && (
          <Link className="underline" href={`?page=${page + 1}`}>
            Older
          </Link>
        )}
      </div>
    </>
  );
}
