/**
 * Profile completeness (0–100). Pure function so it can be unit tested and
 * recomputed after every save. Weights favour the fields that matter most
 * to families evaluating a match.
 */
export type CompletenessInput = {
  displayName?: string | null;
  maritalStatus?: string | null;
  heightCm?: number | null;
  kootam?: string | null;
  aboutMe?: string | null;
  highestEducation?: string | null;
  occupation?: string | null;
  employmentType?: string | null;
  annualIncomeInr?: unknown;
  nativePlace?: string | null;
  currentCity?: string | null;
  currentCountry?: string | null;
  fatherOccupation?: string | null;
  motherOccupation?: string | null;
  familyType?: string | null;
  siblingsSummary?: string | null;
  hasContact: boolean;
  hasPreferences: boolean;
  approvedOrPendingPhotos: number;
  hasHoroscope: boolean;
  horoscopeEnabled: boolean;
};

const filled = (v: unknown) => v !== null && v !== undefined && v !== "";

export function computeCompleteness(p: CompletenessInput): number {
  const items: [boolean, number][] = [
    [filled(p.displayName), 5],
    [filled(p.maritalStatus), 5],
    [filled(p.heightCm), 4],
    [filled(p.kootam), 5],
    [filled(p.aboutMe), 8],
    [filled(p.highestEducation), 6],
    [filled(p.occupation), 6],
    [filled(p.employmentType), 3],
    [filled(p.annualIncomeInr), 3],
    [filled(p.nativePlace), 4],
    [filled(p.currentCity), 5],
    [filled(p.currentCountry), 2],
    [filled(p.fatherOccupation), 3],
    [filled(p.motherOccupation), 3],
    [filled(p.familyType), 2],
    [filled(p.siblingsSummary), 2],
    [p.hasContact, 8],
    [p.hasPreferences, 8],
    [p.approvedOrPendingPhotos > 0, 12],
  ];
  if (p.horoscopeEnabled) items.push([p.hasHoroscope, 6]);
  const total = items.reduce((s, [, w]) => s + w, 0);
  const got = items.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
  return Math.round((got / total) * 100);
}

/** Fields that must be present before a profile can be submitted for publishing. */
export function missingForPublish(p: CompletenessInput): string[] {
  const missing: string[] = [];
  if (!filled(p.displayName)) missing.push("basic");
  if (!filled(p.highestEducation) || !filled(p.occupation)) missing.push("career");
  if (!filled(p.currentCity) || !filled(p.currentCountry)) missing.push("location");
  if (!p.hasContact) missing.push("contact");
  return missing;
}
