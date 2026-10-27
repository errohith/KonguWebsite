import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { formatPublicId } from "@/lib/options";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/modules/auth/current";
import { getEntitlements } from "@/server/modules/membership/entitlements";
import { unreadCount } from "@/server/modules/notifications/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.dashboard") };
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const [user, t, sp] = await Promise.all([requireUser(), getT(), searchParams]);
  const [profile, ent, unread] = await Promise.all([
    db.profile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        profileNumber: true,
        displayName: true,
        status: true,
        completeness: true,
        moderationNote: true,
        verificationState: true,
      },
    }),
    getEntitlements(user.id),
    unreadCount(user.id),
  ]);
  const pendingInterests = profile
    ? await db.interest.count({ where: { receiverProfileId: profile.id, status: "PENDING" } })
    : 0;

  return (
    <>
      <PageHeader
        title={`${t("dashboard.title")}${profile ? `, ${profile.displayName}` : ""}`}
        subtitle={profile ? formatPublicId(profile.profileNumber) : undefined}
      />
      {sp.welcome && (
        <Alert tone="success">{sp.emailFailed ? t("auth.registeredNoEmail") : t("auth.registered")}</Alert>
      )}

      {!profile ? (
        <Card className="to-gold-100/60 bg-gradient-to-br from-white">
          <h2 className="text-maroon-800 text-xl font-semibold">{t("dashboard.createProfile")}</h2>
          <p className="text-muted mt-2">{t("dashboard.createProfileBody")}</p>
          <Link href="/profile/edit/basic" className={buttonClass("primary", "md", "mt-5")}>
            {t("dashboard.createProfile")}
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  profile.status === "PUBLISHED"
                    ? "green"
                    : profile.status === "REJECTED" || profile.status === "SUSPENDED"
                      ? "red"
                      : "gold"
                }
              >
                {t(`enums.ProfileStatus.${profile.status}`)}
              </Badge>
              <Badge tone={profile.verificationState === "VERIFIED" ? "green" : "neutral"}>
                {t(`enums.VerificationState.${profile.verificationState}`)}
              </Badge>
            </div>
            <p className="mt-4 text-sm font-medium">{t("profile.completeness", { percent: profile.completeness })}</p>
            <div
              className="bg-sand mt-2 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={profile.completeness}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="bg-gold-500 h-full rounded-full" style={{ width: `${profile.completeness}%` }} />
            </div>
            {profile.moderationNote && (
              <p className="text-danger-600 mt-3 text-sm">
                {t("profile.moderationNote", { note: profile.moderationNote })}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/profile/edit/basic" className={buttonClass("primary", "sm")}>
                {t("dashboard.continueProfile")}
              </Link>
              <Link
                href={`/profiles/${formatPublicId(profile.profileNumber)}`}
                className={buttonClass("secondary", "sm")}
              >
                {t("profile.viewAsOthers")}
              </Link>
            </div>
          </Card>
          <Card>
            <p className="text-muted text-sm">{t("dashboard.plan", { plan: ent.planName })}</p>
            {ent.endsAt && (
              <p className="text-muted text-sm">
                {t("membership.validUntil", { date: ent.endsAt.toISOString().slice(0, 10) })}
              </p>
            )}
            {!ent.isPremium && (
              <Link href="/membership" className={buttonClass("gold", "sm", "mt-3")}>
                {t("dashboard.upgrade")}
              </Link>
            )}
            <ul className="mt-5 space-y-2 text-sm">
              <li>
                <Link href="/interests?tab=received" className="text-maroon-700 underline">
                  {t("dashboard.pendingInterests", { count: pendingInterests })}
                </Link>
              </li>
              <li>
                <Link href="/notifications" className="text-maroon-700 underline">
                  {t("dashboard.unread", { count: unread })}
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
