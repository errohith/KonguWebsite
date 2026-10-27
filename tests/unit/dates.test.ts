import { describe, expect, it } from "vitest";
import { ageOn, dobRangeForAges, parseIsoDate } from "@/server/lib/dates";

describe("dates", () => {
  const at = new Date("2026-06-15T00:00:00Z");
  it("computes age on calendar boundaries", () => {
    expect(ageOn(new Date("2005-06-15T00:00:00Z"), at)).toBe(21);
    expect(ageOn(new Date("2005-06-16T00:00:00Z"), at)).toBe(20);
  });
  it("builds date-of-birth bounds that match ageOn", () => {
    const { latest, earliestExclusive } = dobRangeForAges(25, 30, at);
    expect(ageOn(latest!, at)).toBe(25);
    expect(ageOn(new Date(earliestExclusive!.getTime() + 86_400_000), at)).toBe(30);
    expect(ageOn(earliestExclusive!, at)).toBe(31);
  });
  it("parses only real ISO dates", () => {
    expect(parseIsoDate("2000-02-29")?.toISOString()).toBe("2000-02-29T00:00:00.000Z");
    expect(parseIsoDate("2001-02-29")).toBeNull();
    expect(parseIsoDate("15/06/2000")).toBeNull();
  });
});
