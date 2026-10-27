import type { Metadata } from "next";
import { VerificationForm } from "@/components/member/verification-form";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { requireActiveMember } from "@/server/modules/auth/current";
import { listOwnVerificationRequests } from "@/server/modules/moderation/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("verification.title") };
}

export default async function VerificationPage() {
  const [user, t] = await Promise.all([requireActiveMember(), getT()]);
  const [profile, requests] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id }, select: { verificationState: true } }),
    listOwnVerificationRequests(user.id),
  ]);
  const enabled = getEnv().ENABLE_PROFILE_VERIFICATION;
  return (
    <>
      <PageHeader title={t("verification.title")} subtitle={t("verification.intro")} />
      {!enabled ? (
        <Alert>{t("verification.disabled")}</Alert>
      ) : !profile ? (
        <Alert>{t("errors.completeBasicFirst")}</Alert>
      ) : (
        <>
          <p>
            <Badge tone={profile.verificationState === "VERIFIED" ? "green" : "gold"}>
              {t(`enums.VerificationState.${profile.verificationState}`)}
            </Badge>
          </p>
          {profile.verificationState !== "VERIFIED" && profile.verificationState !== "PENDING" && (
            <Card>
              <VerificationForm />
            </Card>
          )}
        </>
      )}
      {requests.length > 0 && (
        <Card>
          <h2 className="text-maroon-800 mb-3 text-lg font-semibold">{t("verification.history")}</h2>
          <ul className="divide-line divide-y text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {r.createdAt.toISOString().slice(0, 10)} ·{" "}
                  {r.document ? t(`enums.DocumentType.${r.document.type}`) : "—"}
                </span>
                <span className="text-muted">
                  {r.status}
                  {r.reviewNote ? ` — ${r.reviewNote}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
