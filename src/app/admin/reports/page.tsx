import Link from "next/link";
import { ResolveReportForm } from "@/components/admin/forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { resolveReportAction } from "@/server/actions/admin";
import { requirePermission } from "@/server/modules/auth/current";
import { listReports } from "@/server/modules/moderation/service";

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requirePermission("moderation.manage");
  const sp = await searchParams;
  const tab = sp.tab === "closed" ? "closed" : "open";
  const reports = await listReports(tab);
  return (
    <>
      <PageHeader
        title="Reports"
        actions={
          <div className="flex gap-2 text-sm">
            <Link href="/admin/reports" className="underline">
              Open
            </Link>
            <Link href="/admin/reports?tab=closed" className="underline">
              Closed
            </Link>
          </div>
        }
      />
      {reports.length === 0 ? (
        <EmptyState>No reports.</EmptyState>
      ) : (
        reports.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap justify-between gap-4 text-sm">
              <div className="max-w-xl">
                <p className="font-semibold">
                  {r.publicId} · {r.reportedProfile.displayName} <Badge>{r.reportedProfile.status}</Badge>
                </p>
                <p>
                  <Badge tone="red">{r.reason}</Badge>{" "}
                  <span className="text-muted">
                    by {r.reporter.email} · {r.createdAt.toISOString().slice(0, 10)}
                  </span>
                </p>
                {r.details && <p className="mt-2 whitespace-pre-line">{r.details}</p>}
                {r.resolutionNote && <p className="text-muted mt-2">Resolution: {r.resolutionNote}</p>}
              </div>
              {tab === "open" && (
                <div className="w-full sm:w-72">
                  <ResolveReportForm action={resolveReportAction.bind(null, r.id)} />
                </div>
              )}
            </div>
          </Card>
        ))
      )}
    </>
  );
}
