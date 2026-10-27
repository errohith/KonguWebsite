import { PlanForm } from "@/components/admin/forms";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { savePlanAction } from "@/server/actions/admin";
import { requirePermission } from "@/server/modules/auth/current";
import { listAllPlans } from "@/server/modules/membership/plans";

export default async function PlansPage() {
  await requirePermission("plans.manage");
  const plans = await listAllPlans();
  return (
    <>
      <PageHeader
        title="Membership plans"
        subtitle="Prices and limits are enforced server-side from these values. The FREE plan defines defaults for members without a subscription."
      />
      {plans.map((p) => (
        <Card key={p.id}>
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-semibold">{p.code}</span> · {p.name} · {p.currency} {p.price.toFixed(2)} ·{" "}
              {p.durationDays}d{!p.isActive && <Badge tone="red">inactive</Badge>}
            </summary>
            <div className="mt-4">
              <PlanForm action={savePlanAction.bind(null, p.id)} d={{ ...p, price: p.price.toFixed(2) }} />
            </div>
          </details>
        </Card>
      ))}
      <Card>
        <h2 className="mb-3 font-semibold">New plan</h2>
        <PlanForm action={savePlanAction.bind(null, null)} />
      </Card>
    </>
  );
}
