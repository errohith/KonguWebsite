import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/card";
import { requirePermission } from "@/server/modules/auth/current";
import { hasPermission, type Permission } from "@/server/modules/auth/permissions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const NAV: [string, string, Permission][] = [
  ["/admin", "Overview", "admin.access"],
  ["/admin/members", "Members", "members.view"],
  ["/admin/moderation", "Moderation", "moderation.manage"],
  ["/admin/verifications", "Verifications", "moderation.manage"],
  ["/admin/reports", "Reports", "moderation.manage"],
  ["/admin/support", "Support", "support.manage"],
  ["/admin/plans", "Plans", "plans.manage"],
  ["/admin/subscriptions", "Subscriptions", "payments.manage"],
  ["/admin/payments", "Payments", "payments.manage"],
  ["/admin/content", "Content", "content.manage"],
  ["/admin/audit", "Audit log", "audit.view"],
];

/** Staff area (English only). Each page re-checks its own permission. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requirePermission("admin.access");
  return (
    <Container className="grid gap-6 py-8 lg:grid-cols-[200px_1fr]">
      <nav
        className="flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:self-start"
        aria-label="Admin"
        lang="en"
      >
        {NAV.filter(([, , p]) => hasPermission(user.role, p)).map(([href, label]) => (
          <Link key={href} href={href} className="hover:bg-sand shrink-0 rounded-xl px-3 py-2 text-sm">
            {label}
          </Link>
        ))}
        <p className="text-muted mt-4 hidden px-3 text-xs lg:block">Signed in as {user.role}</p>
      </nav>
      <div className="min-w-0 space-y-6" lang="en">
        {children}
      </div>
    </Container>
  );
}
