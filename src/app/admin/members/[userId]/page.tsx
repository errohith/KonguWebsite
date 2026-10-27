import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmEraseForm, NoteAction, SelectAction } from "@/components/admin/forms";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { UserRole } from "@/generated/prisma/enums";
import {
  cancelSubscriptionAction,
  eraseMemberAction,
  grantSubscriptionAction,
  setMemberRoleAction,
  setMemberStatusAction,
  suspendProfileAction,
} from "@/server/actions/admin";
import { isAppError } from "@/server/lib/errors";
import { getMemberDetail } from "@/server/modules/admin/service";
import { requirePermission } from "@/server/modules/auth/current";
import { hasPermission } from "@/server/modules/auth/permissions";
import { listAllPlans } from "@/server/modules/membership/plans";

export default async function AdminMemberDetail({ params }: PageProps<"/admin/members/[userId]">) {
  const viewer = await requirePermission("members.view");
  const { userId } = await params;
  const m = await getMemberDetail(userId).catch((err) => {
    if (isAppError(err)) notFound();
    throw err;
  });
  const plans = await listAllPlans();
  const canManage = hasPermission(viewer.role, "members.manage");
  const canPay = hasPermission(viewer.role, "payments.manage");
  const canModerate = hasPermission(viewer.role, "moderation.manage");

  return (
    <>
      <PageHeader
        title={m.email}
        subtitle={`${m.publicId ?? "No profile"} · ${m.gender} · joined ${m.createdAt.toISOString().slice(0, 10)}`}
        actions={<Badge tone={m.status === "ACTIVE" ? "green" : "red"}>{m.status}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Account</h2>
          <dl className="space-y-1 text-sm">
            <div>Role: {m.role}</div>
            <div>Phone: {m.phone ?? "—"}</div>
            <div>Email verified: {m.emailVerifiedAt ? m.emailVerifiedAt.toISOString().slice(0, 10) : "no"}</div>
            <div>Last login: {m.lastLoginAt?.toISOString().slice(0, 16) ?? "—"}</div>
            <div>Reports against profile: {m.reportsAgainst}</div>
            {m.deletionScheduledAt && (
              <div className="text-danger-600">
                Deletion scheduled: {m.deletionScheduledAt.toISOString().slice(0, 10)}
              </div>
            )}
          </dl>
          {canManage && m.id !== viewer.id && m.status !== "DELETED" && (
            <div className="border-line mt-4 space-y-3 border-t pt-4">
              <SelectAction
                action={setMemberStatusAction.bind(null, m.id)}
                name="status"
                options={["ACTIVE", "SUSPENDED"]}
                defaultValue={m.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"}
                label="Set status"
                withNote
              />
              {hasPermission(viewer.role, "roles.manage") && (
                <SelectAction
                  action={setMemberRoleAction.bind(null, m.id)}
                  name="role"
                  options={Object.values(UserRole)}
                  defaultValue={m.role}
                  label="Set role"
                />
              )}
            </div>
          )}
        </Card>
        {m.profile && (
          <Card>
            <h2 className="mb-2 font-semibold">Profile</h2>
            <p className="text-sm">
              {m.profile.displayName} · <Badge>{m.profile.status}</Badge> · <Badge>{m.profile.verificationState}</Badge>
            </p>
            <p className="text-muted mt-1 text-sm">
              {m.profile.photos.length} photos · completeness {m.profile.completeness}%
            </p>
            {m.profile.moderationNote && (
              <p className="text-danger-600 mt-1 text-sm">Note: {m.profile.moderationNote}</p>
            )}
            {canModerate && (
              <div className="mt-4 flex flex-wrap gap-4">
                {m.profile.status !== "SUSPENDED" ? (
                  <NoteAction
                    action={suspendProfileAction.bind(null, m.profile.id, true)}
                    label="Suspend profile"
                    variant="danger"
                    notePlaceholder="Reason (shown to member)"
                  />
                ) : (
                  <NoteAction
                    action={suspendProfileAction.bind(null, m.profile.id, false)}
                    label="Reinstate profile"
                    withNote={false}
                  />
                )}
              </div>
            )}
          </Card>
        )}
      </div>
      <Card>
        <h2 className="mb-2 font-semibold">Subscriptions</h2>
        <ul className="divide-line divide-y text-sm">
          {m.subscriptions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {s.plan.name} · {s.startsAt.toISOString().slice(0, 10)} → {s.endsAt.toISOString().slice(0, 10)} ·{" "}
                <Badge>{s.status}</Badge>
              </span>
              {canPay && s.status === "ACTIVE" && (
                <NoteAction
                  action={cancelSubscriptionAction.bind(null, s.id)}
                  label="Cancel"
                  variant="secondary"
                  notePlaceholder="Reason"
                />
              )}
            </li>
          ))}
        </ul>
        {canPay && (
          <div className="border-line mt-4 border-t pt-4">
            <SelectAction
              action={grantSubscriptionAction.bind(null, m.id)}
              name="planCode"
              options={plans.filter((p) => p.code !== "FREE").map((p) => p.code)}
              label="Grant complimentary plan"
            />
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Recent payments</h2>
        <ul className="divide-line divide-y text-sm">
          {m.payments.map((p) => (
            <li key={p.id} className="py-2">
              {p.createdAt.toISOString().slice(0, 10)} · {p.currency} {p.amount.toFixed(2)} · <Badge>{p.status}</Badge>{" "}
              ·{" "}
              <Link className="underline" href={`/admin/payments?status=${p.status}`}>
                view
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      {canManage && m.status !== "DELETED" && m.id !== viewer.id && (
        <Card className="border-danger-600/40">
          <h2 className="text-danger-600 mb-2 font-semibold">Erase personal data</h2>
          <p className="text-muted mb-3 text-sm">
            Permanently deletes the profile, photos and documents and anonymises the account. Payment records are
            retained. This cannot be undone.
          </p>
          <ConfirmEraseForm action={eraseMemberAction.bind(null, m.id)} />
        </Card>
      )}
    </>
  );
}
