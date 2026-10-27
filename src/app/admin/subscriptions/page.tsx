import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { requirePermission } from "@/server/modules/auth/current";
import { listSubscriptions } from "@/server/modules/admin/service";

export default async function SubscriptionsPage({ searchParams }: PageProps<"/admin/subscriptions">) {
  await requirePermission("payments.manage");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const subs = await listSubscriptions(status);
  return (
    <>
      <PageHeader
        title="Subscriptions"
        actions={
          <div className="flex gap-3 text-sm">
            {["ACTIVE", "EXPIRED", "CANCELLED", "REFUNDED"].map((s) => (
              <Link key={s} href={`?status=${s}`} className="underline">
                {s}
              </Link>
            ))}
          </div>
        }
      />
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand text-muted text-xs uppercase">
            <tr>
              <th className="p-3">Member</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Period</th>
              <th className="p-3">Status</th>
              <th className="p-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {subs.map((s) => (
              <tr key={s.id}>
                <td className="p-3">
                  <Link className="text-maroon-700 underline" href={`/admin/members/${s.userId}`}>
                    {s.user.email}
                  </Link>
                </td>
                <td className="p-3">{s.plan.name}</td>
                <td className="p-3">
                  {s.startsAt.toISOString().slice(0, 10)} → {s.endsAt.toISOString().slice(0, 10)}
                </td>
                <td className="p-3">
                  <Badge tone={s.status === "ACTIVE" ? "green" : "neutral"}>{s.status}</Badge>
                </td>
                <td className="text-muted p-3">{s.paymentId ? "payment" : "complimentary"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
