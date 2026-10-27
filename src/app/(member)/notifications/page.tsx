import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { markNotificationsReadAction } from "@/server/actions/members";
import { requireUser } from "@/server/modules/auth/current";
import { listNotifications } from "@/server/modules/notifications/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("notifications.title") };
}

export default async function NotificationsPage() {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const items = await listNotifications(user.id);
  return (
    <>
      <PageHeader
        title={t("notifications.title")}
        actions={
          items.some((n) => !n.readAt) ? (
            <form action={markNotificationsReadAction}>
              <button className={buttonClass("secondary", "sm")}>{t("notifications.markRead")}</button>
            </form>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState>{t("notifications.none")}</EmptyState>
      ) : (
        <ul className="divide-line border-line divide-y overflow-hidden rounded-2xl border bg-white">
          {items.map((n) => (
            <li key={n.id} className={`p-4 ${n.readAt ? "" : "bg-gold-100/40"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {n.link ? (
                      <Link href={n.link} className="hover:underline">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </p>
                  {n.body && <p className="text-muted mt-1 text-sm">{n.body}</p>}
                </div>
                <time className="text-muted shrink-0 text-xs" dateTime={n.createdAt.toISOString()}>
                  {n.createdAt.toISOString().slice(0, 10)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
