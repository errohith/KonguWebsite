import Link from "next/link";
import { RefundForm } from "@/components/admin/forms";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { recordRefundAction } from "@/server/actions/admin";
import { requirePermission } from "@/server/modules/auth/current";
import { listPayments } from "@/server/modules/admin/service";
import { reconciliationReport } from "@/server/modules/payments/service";

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requirePermission("payments.manage");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const [payments, recon] = await Promise.all([listPayments(status), reconciliationReport()]);
  return (
    <>
      <PageHeader
        title="Payments"
        actions={
          <div className="flex gap-3 text-sm">
            {["CREATED", "CAPTURED", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"].map((s) => (
              <Link key={s} href={`?status=${s}`} className="underline">
                {s}
              </Link>
            ))}
          </div>
        }
      />
      <Card>
        <h2 className="mb-2 font-semibold">Reconciliation</h2>
        <ul className="space-y-1 text-sm">
          <li>
            Orders created &gt; 1h ago with no outcome: <strong>{recon.stale.length}</strong> — confirm in the provider
            dashboard.
          </li>
          <li>
            Captured payments without a subscription:{" "}
            <strong className={recon.capturedWithoutSub.length ? "text-danger-600" : ""}>
              {recon.capturedWithoutSub.length}
            </strong>
          </li>
          <li>
            Failed webhook events:{" "}
            <strong className={recon.failedWebhooks.length ? "text-danger-600" : ""}>
              {recon.failedWebhooks.length}
            </strong>{" "}
            (they are retried when the provider re-delivers)
          </li>
        </ul>
      </Card>
      {payments.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <Link className="text-maroon-700 underline" href={`/admin/members/${p.userId}`}>
                {p.user.email}
              </Link>{" "}
              · {p.plan.name} · {p.currency} {p.amount.toFixed(2)}
            </span>
            <span className="text-muted">
              {p.provider} · {p.providerOrderId ?? "—"} · {p.createdAt.toISOString().slice(0, 16)}
            </span>
            <Badge tone={p.status === "CAPTURED" ? "green" : p.status === "FAILED" ? "red" : "neutral"}>
              {p.status}
            </Badge>
          </div>
          {p.refunds.length > 0 && (
            <p className="text-muted mt-2 text-xs">
              Refunds: {p.refunds.map((r) => `${r.amount.toFixed(2)} ${r.status}`).join(", ")}
            </p>
          )}
          {(p.status === "CAPTURED" || p.status === "PARTIALLY_REFUNDED") && (
            <div className="border-line mt-3 border-t pt-3">
              <RefundForm action={recordRefundAction.bind(null, p.id)} />
            </div>
          )}
        </Card>
      ))}
    </>
  );
}
