import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PhotoManager } from "@/components/profile/photo-manager";
import { StepNav } from "@/components/profile/step-nav";
import {
  BasicForm,
  CareerForm,
  ContactForm,
  FamilyForm,
  HoroscopeForm,
  LocationForm,
  PreferencesForm,
  PrivacyForm,
  SubmitProfileForm,
} from "@/components/profile/step-forms";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";
import { saveStepAction, submitProfileAction } from "@/server/actions/profile";
import { requireUser } from "@/server/modules/auth/current";
import { missingForPublish } from "@/server/modules/profiles/completeness";
import { PROFILE_STEPS, type ProfileStep } from "@/server/modules/profiles/schemas";
import { getOwnProfile } from "@/server/modules/profiles/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("profile.wizardTitle") };
}

export default async function EditProfileStepPage({ params }: PageProps<"/profile/edit/[step]">) {
  const [{ step: rawStep }, user, t] = await Promise.all([params, requireUser(), getT()]);
  const env = getEnv();
  const steps = PROFILE_STEPS.filter((s) => s !== "horoscope" || env.ENABLE_HOROSCOPE_FEATURE);
  if (!(steps as readonly string[]).includes(rawStep)) notFound();
  const step = rawStep as ProfileStep;

  const profile = await getOwnProfile(user.id);
  if (!profile && step !== "basic") redirect("/profile/edit/basic");

  const action = saveStepAction.bind(null, step);
  // Flatten the profile and its 1:1 sections into plain, serializable form defaults.
  const merged: Record<string, unknown> = {
    ...(profile ?? {}),
    annualIncomeInr: profile?.annualIncomeInr?.toString() ?? null,
    ...(profile?.horoscope ?? {}),
    ...(profile?.contact ?? {}),
    ...(profile?.preference ?? {}),
  };
  const d: Record<string, string | number | boolean | string[] | null> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) d[k] = v as string | number | boolean | null;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) d[k] = v;
  }

  const missing = profile
    ? missingForPublish({
        ...profile,
        hasContact: !!(profile.contact?.contactPhone || profile.contact?.contactEmail),
        hasPreferences: !!profile.preference,
        approvedOrPendingPhotos: profile.photos.filter((p) => p.moderationStatus !== "REJECTED").length,
        hasHoroscope: !!profile.horoscope,
        horoscopeEnabled: env.ENABLE_HOROSCOPE_FEATURE,
      })
    : ["basic"];

  return (
    <>
      <PageHeader
        title={t("profile.wizardTitle")}
        subtitle={profile ? t("profile.completeness", { percent: profile.completeness }) : undefined}
        actions={
          profile && (
            <Badge tone={profile.status === "PUBLISHED" ? "green" : "gold"}>
              {t(`enums.ProfileStatus.${profile.status}`)}
            </Badge>
          )
        }
      />
      <StepNav steps={steps} current={step} t={t} />
      {profile?.moderationNote && (profile.status === "REJECTED" || profile.status === "SUSPENDED") && (
        <Alert tone="error">{t("profile.moderationNote", { note: profile.moderationNote })}</Alert>
      )}
      <Card>
        <h2 className="text-maroon-800 mb-5 text-xl font-semibold">{t(`profile.steps.${step}`)}</h2>
        {step === "basic" && <BasicForm action={action} d={d} />}
        {step === "career" && <CareerForm action={action} d={d} />}
        {step === "location" && <LocationForm action={action} d={d} />}
        {step === "family" && <FamilyForm action={action} d={d} />}
        {step === "horoscope" && <HoroscopeForm action={action} d={d} />}
        {step === "contact" && <ContactForm action={action} d={d} />}
        {step === "preferences" && <PreferencesForm action={action} d={d} />}
        {step === "photos" && profile && (
          <PhotoManager
            photos={profile.photos.map((p) => ({
              id: p.id,
              isPrimary: p.isPrimary,
              moderationStatus: p.moderationStatus,
              moderationNote: p.moderationNote,
            }))}
            max={env.MAX_PHOTOS_PER_PROFILE}
            maxMb={Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)}
          />
        )}
        {step === "privacy" && <PrivacyForm action={action} d={d} />}
      </Card>
      {step === "privacy" && profile && !["PUBLISHED", "PENDING_REVIEW", "SUSPENDED"].includes(profile.status) && (
        <Card className="border-gold-400 bg-gold-100/40">
          <h2 className="text-maroon-800 text-xl font-semibold">{t("profile.publishTitle")}</h2>
          <p className="text-muted mt-1 text-sm">{t("profile.publishBody")}</p>
          {missing.length > 0 && (
            <p className="text-danger-600 mt-3 text-sm">
              {t("profile.missing", { sections: missing.map((m) => t(`profile.steps.${m}`)).join(", ") })}
            </p>
          )}
          <div className="mt-4">
            <SubmitProfileForm action={submitProfileAction} />
          </div>
        </Card>
      )}
    </>
  );
}
