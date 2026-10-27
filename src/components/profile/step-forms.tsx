"use client";

import type { ActionState } from "@/lib/action-state";
import {
  ActionForm,
  CheckboxField,
  CheckboxGroup,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import { useT } from "@/i18n/client";
import {
  COUNTRIES,
  CREATED_FOR,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  FAMILY_STATUSES,
  FAMILY_TYPES,
  KOOTAMS,
  MARITAL_STATUSES,
  NAKSHATRAMS,
  PHOTO_VISIBILITIES,
  PROFILE_VISIBILITIES,
  RASIS,
  RESIDENCY_STATUSES,
} from "@/lib/options";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;
type Defaults = Record<string, string | number | boolean | string[] | null | undefined>;

const str = (v: Defaults[string]) => (v === null || v === undefined ? "" : String(v));

function useEnumOptions() {
  const t = useT();
  return (name: string, values: readonly string[]) => values.map((v) => ({ value: v, label: t(`enums.${name}.${v}`) }));
}

function Buttons({ last }: { last?: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-3 pt-2">
      {!last && (
        <SubmitButton name="intent" value="next">
          {t("profile.saveNext")}
        </SubmitButton>
      )}
      <SubmitButton variant="secondary" name="intent" value="stay">
        {t("profile.save")}
      </SubmitButton>
    </div>
  );
}

export function BasicForm({ action, d }: { action: Action; d: Defaults }) {
  const t = useT();
  const opts = useEnumOptions();
  const f = (k: string) => t(`profile.fields.${k}`);
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="createdFor"
          label={f("createdFor")}
          options={opts("ProfileCreatedFor", CREATED_FOR)}
          defaultValue={str(d.createdFor) || "SELF"}
        />
        <TextField
          name="displayName"
          label={f("displayName")}
          hint={f("displayNameHint")}
          defaultValue={str(d.displayName)}
          required
        />
        <SelectField
          name="maritalStatus"
          label={f("maritalStatus")}
          options={opts("MaritalStatus", MARITAL_STATUSES)}
          defaultValue={str(d.maritalStatus) || "NEVER_MARRIED"}
        />
        <TextField
          name="heightCm"
          type="number"
          min={100}
          max={250}
          label={f("heightCm")}
          defaultValue={str(d.heightCm)}
        />
        <TextField name="motherTongue" label={f("motherTongue")} defaultValue={str(d.motherTongue) || "Tamil"} />
        <TextField name="religion" label={f("religion")} defaultValue={str(d.religion) || "Hindu"} />
        <TextField
          name="community"
          label={f("community")}
          defaultValue={str(d.community) || "Kongu Vellalar Gounder"}
        />
        <TextField name="kootam" label={f("kootam")} defaultValue={str(d.kootam)} list="kootam-list" />
        <datalist id="kootam-list">
          {KOOTAMS.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </div>
      <TextArea name="aboutMe" label={f("aboutMe")} defaultValue={str(d.aboutMe)} rows={5} maxLength={2000} />
      <Buttons />
    </ActionForm>
  );
}

export function CareerForm({ action, d }: { action: Action; d: Defaults }) {
  const t = useT();
  const opts = useEnumOptions();
  const f = (k: string) => t(`profile.fields.${k}`);
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="highestEducation"
          label={f("highestEducation")}
          placeholder={t("common.select")}
          options={opts("EducationLevel", EDUCATION_LEVELS)}
          defaultValue={str(d.highestEducation)}
          required
        />
        <TextField name="educationDetail" label={f("educationDetail")} defaultValue={str(d.educationDetail)} />
        <TextField name="occupation" label={f("occupation")} defaultValue={str(d.occupation)} required />
        <SelectField
          name="employmentType"
          label={f("employmentType")}
          placeholder={t("common.select")}
          options={opts("EmploymentType", EMPLOYMENT_TYPES)}
          defaultValue={str(d.employmentType)}
        />
        <TextField
          name="annualIncomeInr"
          inputMode="decimal"
          label={f("annualIncomeInr")}
          defaultValue={str(d.annualIncomeInr)}
        />
      </div>
      <Buttons />
    </ActionForm>
  );
}

export function LocationForm({ action, d }: { action: Action; d: Defaults }) {
  const t = useT();
  const opts = useEnumOptions();
  const f = (k: string) => t(`profile.fields.${k}`);
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="nativePlace" label={f("nativePlace")} defaultValue={str(d.nativePlace)} />
        <TextField name="nativeDistrict" label={f("nativeDistrict")} defaultValue={str(d.nativeDistrict)} />
        <TextField name="currentCity" label={f("currentCity")} defaultValue={str(d.currentCity)} required />
        <TextField name="currentState" label={f("currentState")} defaultValue={str(d.currentState)} />
        <SelectField
          name="currentCountry"
          label={f("currentCountry")}
          options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
          defaultValue={str(d.currentCountry) || "IN"}
        />
        <SelectField
          name="residencyStatus"
          label={f("residencyStatus")}
          placeholder={t("common.select")}
          options={opts("ResidencyStatus", RESIDENCY_STATUSES)}
          defaultValue={str(d.residencyStatus)}
        />
      </div>
      <Buttons />
    </ActionForm>
  );
}

export function FamilyForm({ action, d }: { action: Action; d: Defaults }) {
  const t = useT();
  const opts = useEnumOptions();
  const f = (k: string) => t(`profile.fields.${k}`);
  return (
    <ActionForm action={action}>
      <p className="text-muted text-sm">{t("profile.familyOptional")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="fatherOccupation" label={f("fatherOccupation")} defaultValue={str(d.fatherOccupation)} />
        <TextField name="motherOccupation" label={f("motherOccupation")} defaultValue={str(d.motherOccupation)} />
        <TextField name="siblingsSummary" label={f("siblingsSummary")} defaultValue={str(d.siblingsSummary)} />
        <SelectField
          name="familyType"
          label={f("familyType")}
          placeholder={t("common.select")}
          options={opts("FamilyType", FAMILY_TYPES)}
          defaultValue={str(d.familyType)}
        />
        <SelectField
          name="familyStatus"
          label={f("familyStatus")}
          placeholder={t("common.select")}
          options={opts("FamilyStatus", FAMILY_STATUSES)}
          defaultValue={str(d.familyStatus)}
        />
      </div>
      <TextArea name="familyDetails" label={f("familyDetails")} defaultValue={str(d.familyDetails)} />
      <Buttons />
    </ActionForm>
  );
}

export function HoroscopeForm({ action, d }: { action: Action; d: Defaults }) {
  const t = useT();
  const f = (k: string) => t(`profile.fields.${k}`);
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="rasi"
          label={f("rasi")}
          placeholder={t("common.select")}
          options={RASIS.map((v) => ({ value: v, label: v }))}
          defaultValue={str(d.rasi)}
        />
        <SelectField
          name="nakshatram"
          label={f("nakshatram")}
          placeholder={t("common.select")}
          options={NAKSHATRAMS.map((v) => ({ value: v, label: v }))}
          defaultValue={str(d.nakshatram)}
        />
        <SelectField
          name="lagnam"
          label={f("lagnam")}
          placeholder={t("common.select")}
          options={RASIS.map((v) => ({ value: v, label: v }))}
          defaultValue={str(d.lagnam)}
        />
        <TextField name="dosham" label={f("dosham")} defaultValue={str(d.dosham)} />
        <TextField name="birthTime" type="time" label={f("birthTime")} defaultValue={str(d.birthTime)} />
        <TextField name="birthPlace" label={f("birthPlace")} defaultValue={str(d.birthPlace)} />
      </div>
      <Buttons />
    </ActionForm>
  );
}

export function ContactForm({ action, d }: { action: Action; d: Defaults }) {
  const t = useT();
  const f = (k: string) => t(`profile.fields.${k}`);
  return (
    <ActionForm action={action}>
      <p className="bg-leaf-50 text-leaf-600 rounded-xl px-4 py-3 text-sm">{t("profile.contactPrivate")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="contactName" label={f("contactName")} defaultValue={str(d.contactName)} />
        <TextField name="relationship" label={f("relationship")} defaultValue={str(d.relationship)} />
        <TextField
          name="contactPhone"
          type="tel"
          label={f("contactPhone")}
          hint={t("auth.phoneHint")}
          defaultValue={str(d.contactPhone)}
        />
        <TextField name="contactEmail" type="email" label={f("contactEmail")} defaultValue={str(d.contactEmail)} />
      </div>
      <Buttons />
    </ActionForm>
  );
}

export function PreferencesForm({ action, d }: { action: Action; d: Defaults }) {
  const t = useT();
  const opts = useEnumOptions();
  const f = (k: string) => t(`profile.fields.${k}`);
  const arr = (v: Defaults[string]) => (Array.isArray(v) ? v : []);
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-4">
        <TextField
          name="ageMin"
          type="number"
          min={18}
          max={80}
          label={`${f("ageRange")} — ${f("min")}`}
          defaultValue={str(d.ageMin)}
        />
        <TextField
          name="ageMax"
          type="number"
          min={18}
          max={80}
          label={`${f("ageRange")} — ${f("max")}`}
          defaultValue={str(d.ageMax)}
        />
        <TextField
          name="heightMinCm"
          type="number"
          min={100}
          max={250}
          label={`${f("heightRange")} — ${f("min")}`}
          defaultValue={str(d.heightMinCm)}
        />
        <TextField
          name="heightMaxCm"
          type="number"
          min={100}
          max={250}
          label={`${f("heightRange")} — ${f("max")}`}
          defaultValue={str(d.heightMaxCm)}
        />
      </div>
      <CheckboxGroup
        name="maritalStatuses"
        label={f("maritalStatuses")}
        options={opts("MaritalStatus", MARITAL_STATUSES)}
        defaultValues={arr(d.maritalStatuses)}
      />
      <CheckboxGroup
        name="educationLevels"
        label={f("educationLevels")}
        options={opts("EducationLevel", EDUCATION_LEVELS)}
        defaultValues={arr(d.educationLevels)}
      />
      <CheckboxGroup
        name="employmentTypes"
        label={f("employmentTypes")}
        options={opts("EmploymentType", EMPLOYMENT_TYPES)}
        defaultValues={arr(d.employmentTypes)}
      />
      <CheckboxGroup
        name="countries"
        label={f("countries")}
        options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
        defaultValues={arr(d.countries)}
      />
      <TextField name="states" label={f("states")} defaultValue={arr(d.states).join(", ")} />
      <CheckboxField
        name="excludeSameKootam"
        label={f("excludeSameKootam")}
        defaultChecked={d.excludeSameKootam !== false}
      />
      <TextArea name="aboutPartner" label={f("aboutPartner")} defaultValue={str(d.aboutPartner)} />
      <Buttons />
    </ActionForm>
  );
}

export function PrivacyForm({ action, d }: { action: Action; d: Defaults }) {
  const t = useT();
  const opts = useEnumOptions();
  const f = (k: string) => t(`profile.fields.${k}`);
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="visibility"
          label={f("visibility")}
          options={opts("ProfileVisibility", PROFILE_VISIBILITIES)}
          defaultValue={str(d.visibility) || "MEMBERS"}
        />
        <SelectField
          name="photoVisibility"
          label={f("photoVisibility")}
          options={opts("PhotoVisibility", PHOTO_VISIBILITIES)}
          defaultValue={str(d.photoVisibility) || "MEMBERS"}
        />
      </div>
      <Buttons last />
    </ActionForm>
  );
}

export function SubmitProfileForm({ action }: { action: (s: ActionState) => Promise<ActionState> }) {
  const t = useT();
  return (
    <ActionForm action={action}>
      <SubmitButton variant="gold" size="lg">
        {t("profile.publish")}
      </SubmitButton>
    </ActionForm>
  );
}
