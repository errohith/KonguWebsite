import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/card";
import { requirePermission } from "@/server/modules/auth/current";
import { dashboardStats } from "@/server/modules/admin/service";
import { moderationQueues } from "@/server/modules/moderation/service";

export default async function AdminHome() {
  await requirePermission("admin.access");
  const [stats, queues] = await Promise.all([dashboardStats(), moderationQueues()]);
  const tiles = [
    ["Members", stats.members, "/admin/members"],
    ["Published profiles", stats.published, "/admin/members"],
    ["Active subscriptions", stats.activeSubs, "/admin/subscriptions"],
    ["Net revenue (INR)", stats.netRevenue, "/admin/payments"],
    ["Open tickets", stats.openTickets, "/admin/support"],
  ] as const;
  const queueTiles = [
    ["Profiles awaiting review", queues.profiles, "/admin/moderation"],
    ["Photos awaiting review", queues.photos, "/admin/moderation"],
    ["Verification requests", queues.verifications, "/admin/verifications"],
    ["Open reports", queues.reports, "/admin/reports"],
  ] as const;
  return (
    <>
      <PageHeader title="Administration" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map(([label, value, href]) => (
          <Link key={label} href={href}>
            <Card>
              <p className="text-muted text-sm">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </Card>
          </Link>
        ))}
      </div>
      <h2 className="text-maroon-800 text-lg font-semibold">Queues</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {queueTiles.map(([label, value, href]) => (
          <Link key={label} href={href}>
            <Card className={value > 0 ? "border-gold-400" : ""}>
              <p className="text-muted text-sm">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
