/** Date helpers. All persisted timestamps are UTC; dates of birth are calendar dates. */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Age in whole years on `at`, comparing calendar dates in UTC. */
export function ageOn(dateOfBirth: Date, at: Date = new Date()): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const m = at.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return age;
}

/**
 * Bounds on date of birth for an age range [minAge, maxAge] on `at`.
 * Someone aged exactly maxAge was born after (at - (maxAge+1) years).
 */
export function dobRangeForAges(minAge?: number, maxAge?: number, at: Date = new Date()) {
  const y = at.getUTCFullYear();
  const mo = at.getUTCMonth();
  const d = at.getUTCDate();
  return {
    // born on or before this date => age >= minAge
    latest: minAge !== undefined ? new Date(Date.UTC(y - minAge, mo, d)) : undefined,
    // born strictly after this date => age <= maxAge
    earliestExclusive: maxAge !== undefined ? new Date(Date.UTC(y - maxAge - 1, mo, d)) : undefined,
  };
}

/** Parses "YYYY-MM-DD" to a UTC midnight Date, or null if invalid. */
export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function startOfUtcDay(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}
