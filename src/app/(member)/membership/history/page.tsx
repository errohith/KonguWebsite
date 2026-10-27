import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/modules/auth/current";
import { listPaymentsForUser, listSubscriptionsForUser } from "@/server/modules/payments/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("membership.history") };
}

export default async function PaymentHistoryPage() {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const [payments, subscriptions] = await Promise.all([
    listPaymentsForUser(user.id),
    listSubscriptionsForUser(user.id),
  ]);
  return (
    <>
      <PageHeader title={t("membership.history")} />
      <Card>
        <h2 className="text-maroon-800 mb-3 text-lg font-semibold">{t("nav.membership")}</h2>
        {subscriptions.length === 0 ? (
          <EmptyState>—</EmptyState>
        ) : (
          <ul className="divide-line divide-y text-sm">
            {subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{s.plan.name}</span>
                <span className="text-muted">
                  {s.startsAt.toISOString().slice(0, 10)} → {s.endsAt.toISOString().slice(0, 10)}
                </span>
                <Badge tone={s.status === "ACTIVE" ? "green" : "neutral"}>{s.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="text-maroon-800 mb-3 text-lg font-semibold">{t("membership.history")}</h2>
        {payments.length === 0 ? (
          <EmptyState>—</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-line divide-y">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3">{p.createdAt.toISOString().slice(0, 10)}</td>
                    <td className="py-2 pr-3">{p.plan.name}</td>
                    <td className="py-2 pr-3">
                      {p.currency} {p.amount.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={p.status === "CAPTURED" ? "green" : p.status === "FAILED" ? "red" : "neutral"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="text-muted py-2">
                      {p.amountRefunded.gt(0) ? `−${p.amountRefunded.toFixed(2)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
