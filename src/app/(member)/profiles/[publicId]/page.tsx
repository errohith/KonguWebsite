import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactPanel, InterestPanel, SafetyActions, ShortlistButton } from "@/components/profile/profile-actions";
import { Badge, Card } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import type { Translator } from "@/i18n/translate";
import { db } from "@/server/db/client";
import { isAppError } from "@/server/lib/errors";
import { requireUser } from "@/server/modules/auth/current";
import { interestStatusWith } from "@/server/modules/interests/service";
import { getProfileForViewer } from "@/server/modules/profiles/service";

export const metadata: Metadata = { robots: { index: false } };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[minmax(120px,40%)_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const en = (t: Translator, name: string, v: string | null) => (v ? t(`enums.${name}.${v}`) : null);

export default async function ProfileViewPage({ params }: PageProps<"/profiles/[publicId]">) {
  const [{ publicId }, user, t] = await Promise.all([params, requireUser(), getT()]);
  let view;
  try {
    view = await getProfileForViewer(user, publicId.toUpperCase());
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  const { profile: p, access, photos, horoscope, preference, contact } = view;
  const f = (k: string) => t(`profile.fields.${k}`);

  const targetProfileId = access.isOwner ? undefined : view.targetProfileId;
  const [interest, shortlisted] = targetProfileId
    ? await Promise.all([
        interestStatusWith(user.id, targetProfileId),
        db.shortlist
          .findUnique({ where: { userId_targetProfileId: { userId: user.id, targetProfileId } } })
          .then(Boolean),
      ])
    : [null, false];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <Card className="p-0 sm:p-0">
          <div className="grid gap-0 sm:grid-cols-[260px_1fr]">
            <div className="bg-sand">
              {photos.length ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/photos/${photos[0].id}`}
                  alt={p.displayName}
                  className="aspect-[4/5] w-full object-cover sm:rounded-l-2xl"
                />
              ) : (
                <div className="text-muted grid aspect-[4/5] place-items-center p-6 text-center text-sm">
                  {access.canSeePhotos ? t("view.noPhoto") : t("view.photosHidden")}
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-maroon-800 text-3xl font-semibold">{p.displayName}</h1>
                {p.verified && <Badge tone="green">✓ {t("view.verified")}</Badge>}
              </div>
              <p className="text-muted mt-1 text-sm">{p.publicId}</p>
              <p className="mt-4 text-lg">
                {t("view.age", { age: p.age })}
                {p.heightCm ? ` · ${t("common.cm", { value: p.heightCm })}` : ""} ·{" "}
                {en(t, "MaritalStatus", p.maritalStatus)}
              </p>
              <p className="text-muted">{[p.occupation, p.currentCity, p.currentState].filter(Boolean).join(" · ")}</p>
              {p.status && (
                <p className="mt-3">
                  <Badge tone="gold">{t("profile.status", { status: t(`enums.ProfileStatus.${p.status}`) })}</Badge>
                </p>
              )}
              {photos.length > 1 && (
                <div className="mt-5 flex gap-2 overflow-x-auto">
                  {photos.slice(1).map((ph) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={ph.id}
                      src={`/api/media/photos/${ph.id}`}
                      alt=""
                      className="size-20 shrink-0 rounded-xl object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {p.aboutMe && (
          <Card>
            <h2 className="text-maroon-800 text-lg font-semibold">{t("view.sections.about")}</h2>
            <p className="mt-2 whitespace-pre-line">{p.aboutMe}</p>
          </Card>
        )}

        <Card>
          <h2 className="text-maroon-800 text-lg font-semibold">{t("view.sections.basic")}</h2>
          <dl className="divide-line/60 mt-2 divide-y">
            <Row label={f("createdFor")} value={en(t, "ProfileCreatedFor", p.createdFor)} />
            <Row label={f("motherTongue")} value={p.motherTongue} />
            <Row label={f("religion")} value={p.religion} />
            <Row label={f("community")} value={p.community} />
            <Row label={f("kootam")} value={p.kootam} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-maroon-800 text-lg font-semibold">{t("view.sections.career")}</h2>
          <dl className="divide-line/60 mt-2 divide-y">
            <Row label={f("highestEducation")} value={en(t, "EducationLevel", p.highestEducation)} />
            <Row label={f("educationDetail")} value={p.educationDetail} />
            <Row label={f("occupation")} value={p.occupation} />
            <Row label={f("employmentType")} value={en(t, "EmploymentType", p.employmentType)} />
            <Row
              label={f("annualIncomeInr")}
              value={p.annualIncomeInr ? `₹${Number(p.annualIncomeInr).toLocaleString("en-IN")}` : null}
            />
          </dl>
        </Card>

        <Card>
          <h2 className="text-maroon-800 text-lg font-semibold">{t("view.sections.location")}</h2>
          <dl className="divide-line/60 mt-2 divide-y">
            <Row label={f("nativePlace")} value={[p.nativePlace, p.nativeDistrict].filter(Boolean).join(", ")} />
            <Row
              label={f("currentCity")}
              value={[p.currentCity, p.currentState, p.currentCountry].filter(Boolean).join(", ")}
            />
            <Row label={f("residencyStatus")} value={en(t, "ResidencyStatus", p.residencyStatus)} />
          </dl>
        </Card>

        {(p.fatherOccupation || p.motherOccupation || p.siblingsSummary || p.familyType || p.familyDetails) && (
          <Card>
            <h2 className="text-maroon-800 text-lg font-semibold">{t("view.sections.family")}</h2>
            <dl className="divide-line/60 mt-2 divide-y">
              <Row label={f("fatherOccupation")} value={p.fatherOccupation} />
              <Row label={f("motherOccupation")} value={p.motherOccupation} />
              <Row label={f("siblingsSummary")} value={p.siblingsSummary} />
              <Row label={f("familyType")} value={en(t, "FamilyType", p.familyType)} />
              <Row label={f("familyStatus")} value={en(t, "FamilyStatus", p.familyStatus)} />
              <Row label={f("familyDetails")} value={p.familyDetails} />
            </dl>
          </Card>
        )}

        {horoscope && (
          <Card>
            <h2 className="text-maroon-800 text-lg font-semibold">{t("view.sections.horoscope")}</h2>
            <dl className="divide-line/60 mt-2 divide-y">
              <Row label={f("rasi")} value={horoscope.rasi} />
              <Row label={f("nakshatram")} value={horoscope.nakshatram} />
              <Row label={f("lagnam")} value={horoscope.lagnam} />
              <Row label={f("dosham")} value={horoscope.dosham} />
              <Row label={f("birthTime")} value={horoscope.birthTime} />
              <Row label={f("birthPlace")} value={horoscope.birthPlace} />
            </dl>
          </Card>
        )}

        {preference && (
          <Card>
            <h2 className="text-maroon-800 text-lg font-semibold">{t("view.sections.preferences")}</h2>
            <dl className="divide-line/60 mt-2 divide-y">
              <Row
                label={f("ageRange")}
                value={
                  preference.ageMin || preference.ageMax
                    ? `${preference.ageMin ?? "18"} – ${preference.ageMax ?? "…"}`
                    : null
                }
              />
              <Row
                label={f("heightRange")}
                value={
                  preference.heightMinCm || preference.heightMaxCm
                    ? `${preference.heightMinCm ?? "…"} – ${preference.heightMaxCm ?? "…"}`
                    : null
                }
              />
              <Row
                label={f("maritalStatuses")}
                value={preference.maritalStatuses.map((m) => en(t, "MaritalStatus", m)).join(", ")}
              />
              <Row
                label={f("educationLevels")}
                value={preference.educationLevels.map((m) => en(t, "EducationLevel", m)).join(", ")}
              />
              <Row label={f("aboutPartner")} value={preference.aboutPartner} />
            </dl>
          </Card>
        )}
      </div>

      {!access.isOwner && (
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <InterestPanel publicId={p.publicId} interest={interest} />
          </Card>
          <ShortlistButton publicId={p.publicId} shortlisted={shortlisted} />
          <Card>
            <h2 className="text-maroon-800 mb-3 font-semibold">{t("view.contactTitle")}</h2>
            <ContactPanel publicId={p.publicId} contact={contact} lockedReason={access.contactLockedReason} />
          </Card>
          <SafetyActions publicId={p.publicId} />
        </aside>
      )}
    </div>
  );
}
