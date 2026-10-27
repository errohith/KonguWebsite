import type { Metadata } from "next";
import Link from "next/link";
import { ZodError } from "zod";
import { NeedPublishedProfile } from "@/components/profile/need-profile";
import { Pagination, ProfileCard } from "@/components/profile/profile-card";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { COUNTRIES, EDUCATION_LEVELS, EMPLOYMENT_TYPES, MARITAL_STATUSES } from "@/lib/options";
import { requireActiveMember } from "@/server/modules/auth/current";
import { canDiscover } from "@/server/modules/discovery/guard";
import { searchProfiles } from "@/server/modules/discovery/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("search.title") };
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const [user, t, sp] = await Promise.all([requireActiveMember(), getT(), searchParams]);
  if (!(await canDiscover(user.id))) {
    return (
      <>
        <PageHeader title={t("search.title")} />
        <NeedPublishedProfile t={t} />
      </>
    );
  }
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const many = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : []);
  const result = await searchProfiles(user, {
    ageMin: one("ageMin"),
    ageMax: one("ageMax"),
    heightMinCm: one("heightMinCm"),
    heightMaxCm: one("heightMaxCm"),
    maritalStatus: many("maritalStatus"),
    education: many("education"),
    employment: many("employment"),
    country: one("country"),
    state: one("state") || undefined,
    city: one("city") || undefined,
    occupation: one("occupation") || undefined,
    excludeKootam: one("excludeKootam"),
    verifiedOnly: one("verifiedOnly"),
    withPhoto: one("withPhoto"),
    sort: one("sort"),
    page: one("page") || 1,
  }).catch((err) => {
    if (err instanceof ZodError) return null;
    throw err;
  });

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "page" || v === undefined) continue;
      for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
    }
    params.set("page", String(page));
    return `/search?${params}`;
  };
  const checked = (k: string, v: string) => many(k).includes(v);

  return (
    <>
      <PageHeader title={t("search.title")} />
      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <form method="get" className="space-y-4">
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1 text-sm font-medium">{t("profile.fields.ageRange")}</legend>
              <input
                name="ageMin"
                type="number"
                min={18}
                max={80}
                placeholder={t("profile.fields.min")}
                defaultValue={one("ageMin")}
                className={inputCls}
                aria-label={`${t("profile.fields.ageRange")} ${t("profile.fields.min")}`}
              />
              <input
                name="ageMax"
                type="number"
                min={18}
                max={80}
                placeholder={t("profile.fields.max")}
                defaultValue={one("ageMax")}
                className={inputCls}
                aria-label={`${t("profile.fields.ageRange")} ${t("profile.fields.max")}`}
              />
            </fieldset>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1 text-sm font-medium">{t("profile.fields.heightRange")}</legend>
              <input
                name="heightMinCm"
                type="number"
                min={100}
                max={250}
                placeholder={t("profile.fields.min")}
                defaultValue={one("heightMinCm")}
                className={inputCls}
                aria-label={`${t("profile.fields.heightRange")} ${t("profile.fields.min")}`}
              />
              <input
                name="heightMaxCm"
                type="number"
                min={100}
                max={250}
                placeholder={t("profile.fields.max")}
                defaultValue={one("heightMaxCm")}
                className={inputCls}
                aria-label={`${t("profile.fields.heightRange")} ${t("profile.fields.max")}`}
              />
            </fieldset>
            <label className="block text-sm font-medium">
              {t("profile.fields.currentCountry")}
              <select name="country" defaultValue={one("country")} className={`${inputCls} mt-1`}>
                <option value="">{t("search.any")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              {t("search.state")}
              <input name="state" defaultValue={one("state")} className={`${inputCls} mt-1`} />
            </label>
            <label className="block text-sm font-medium">
              {t("search.city")}
              <input name="city" defaultValue={one("city")} className={`${inputCls} mt-1`} />
            </label>
            <label className="block text-sm font-medium">
              {t("search.occupation")}
              <input name="occupation" defaultValue={one("occupation")} className={`${inputCls} mt-1`} />
            </label>
            {(
              [
                ["maritalStatus", "MaritalStatus", MARITAL_STATUSES, "maritalStatuses"],
                ["education", "EducationLevel", EDUCATION_LEVELS, "educationLevels"],
                ["employment", "EmploymentType", EMPLOYMENT_TYPES, "employmentTypes"],
              ] as const
            ).map(([name, enumName, values, label]) => (
              <details key={name} className="border-line rounded-xl border p-3" open={many(name).length > 0}>
                <summary className="cursor-pointer text-sm font-medium">{t(`profile.fields.${label}`)}</summary>
                <div className="mt-2 space-y-1.5">
                  {values.map((v) => (
                    <label key={v} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={name}
                        value={v}
                        defaultChecked={checked(name, v)}
                        className="accent-maroon-700"
                      />
                      {t(`enums.${enumName}.${v}`)}
                    </label>
                  ))}
                </div>
              </details>
            ))}
            {(["excludeKootam", "verifiedOnly", "withPhoto"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={k}
                  value="on"
                  defaultChecked={one(k) === "on"}
                  className="accent-maroon-700"
                />
                {t(`search.${k}`)}
              </label>
            ))}
            <label className="block text-sm font-medium">
              {t("search.sort")}
              <select name="sort" defaultValue={one("sort") || "newest"} className={`${inputCls} mt-1`}>
                <option value="newest">{t("search.sortNewest")}</option>
                <option value="active">{t("search.sortActive")}</option>
                <option value="age_asc">{t("search.sortAgeAsc")}</option>
                <option value="age_desc">{t("search.sortAgeDesc")}</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button className={buttonClass("primary", "md", "flex-1")}>{t("search.apply")}</button>
              <Link href="/search" className={buttonClass("secondary", "md")}>
                {t("search.reset")}
              </Link>
            </div>
          </form>
        </Card>
        <div>
          {!result ? (
            <EmptyState>{t("errors.VALIDATION")}</EmptyState>
          ) : result.items.length === 0 ? (
            <EmptyState>{t("search.none")}</EmptyState>
          ) : (
            <>
              <p className="text-muted mb-4 text-sm">{t("search.results", { count: result.total })}</p>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {result.items.map((card) => (
                  <ProfileCard key={card.publicId} card={card} t={t} />
                ))}
              </div>
              <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} t={t} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
