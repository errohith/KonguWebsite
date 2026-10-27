import type { Metadata } from "next";
import {
  ChangePasswordForm,
  DeactivateForm,
  DeleteAccountForm,
  ReactivateButton,
  UnblockButton,
} from "@/components/member/settings-forms";
import { buttonClass } from "@/components/ui/button";
import { Alert, Card, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { requireUser } from "@/server/modules/auth/current";
import { listBlocked } from "@/server/modules/privacy/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("settings.title") };
}

export default async function SettingsPage() {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const [blocked, account] = await Promise.all([
    listBlocked(user.id),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { deletionScheduledAt: true } }),
  ]);
  const inactive = user.status === "DEACTIVATED" || user.status === "DELETION_REQUESTED";

  return (
    <>
      <PageHeader title={t("settings.title")} />
      {inactive && (
        <Card className="border-danger-600/30">
          {account.deletionScheduledAt && (
            <div className="mb-4">
              <Alert tone="error">
                {t("settings.deletionScheduled", { date: account.deletionScheduledAt.toISOString().slice(0, 10) })}
              </Alert>
            </div>
          )}
          <ReactivateButton />
        </Card>
      )}
      <Card>
        <h2 className="text-maroon-800 mb-4 text-lg font-semibold">{t("settings.changePassword")}</h2>
        <ChangePasswordForm />
      </Card>
      <Card>
        <h2 id="blocked" className="text-maroon-800 mb-4 text-lg font-semibold">
          {t("settings.blocked")}
        </h2>
        {blocked.length === 0 ? (
          <p className="text-muted text-sm">{t("settings.noneBlocked")}</p>
        ) : (
          <ul className="divide-line divide-y">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {b.displayName ?? "—"} <span className="text-muted">{b.publicId}</span>
                </span>
                <UnblockButton blockId={b.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="text-maroon-800 text-lg font-semibold">{t("settings.exportTitle")}</h2>
        <p className="text-muted mt-1 mb-4 text-sm">{t("settings.exportBody")}</p>
        <a href="/api/account/export" className={buttonClass("secondary")}>
          {t("settings.exportButton")}
        </a>
      </Card>
      {!inactive && (
        <Card>
          <h2 className="text-maroon-800 text-lg font-semibold">{t("settings.deactivateTitle")}</h2>
          <p className="text-muted mt-1 mb-4 text-sm">{t("settings.deactivateBody")}</p>
          <DeactivateForm />
        </Card>
      )}
      {user.status !== "DELETION_REQUESTED" && (
        <Card className="border-danger-600/30">
          <h2 className="text-danger-600 text-lg font-semibold">{t("settings.deleteTitle")}</h2>
          <p className="text-muted mt-1 mb-4 text-sm">
            {t("settings.deleteBody", { days: getEnv().ACCOUNT_DELETION_GRACE_DAYS })}
          </p>
          <DeleteAccountForm />
        </Card>
      )}
    </>
  );
}
