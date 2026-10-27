import { describe, expect, it } from "vitest";
import { computeCompleteness, missingForPublish, type CompletenessInput } from "@/server/modules/profiles/completeness";

const empty: CompletenessInput = {
  hasContact: false,
  hasPreferences: false,
  approvedOrPendingPhotos: 0,
  hasHoroscope: false,
  horoscopeEnabled: false,
};

describe("profile completeness", () => {
  it("is 0 for an empty profile and 100 for a full one", () => {
    expect(computeCompleteness(empty)).toBe(0);
    const full: CompletenessInput = {
      displayName: "A",
      maritalStatus: "NEVER_MARRIED",
      heightCm: 170,
      kootam: "Sellan",
      aboutMe: "x",
      highestEducation: "BACHELORS",
      occupation: "x",
      employmentType: "PRIVATE",
      annualIncomeInr: "1",
      nativePlace: "x",
      currentCity: "x",
      currentCountry: "IN",
      fatherOccupation: "x",
      motherOccupation: "x",
      familyType: "NUCLEAR",
      siblingsSummary: "x",
      hasContact: true,
      hasPreferences: true,
      approvedOrPendingPhotos: 1,
      hasHoroscope: true,
      horoscopeEnabled: true,
    };
    expect(computeCompleteness(full)).toBe(100);
  });
  it("lists sections required before publishing", () => {
    expect(missingForPublish(empty)).toEqual(["basic", "career", "location", "contact"]);
    expect(
      missingForPublish({
        ...empty,
        displayName: "A",
        highestEducation: "X",
        occupation: "Y",
        currentCity: "C",
        currentCountry: "IN",
        hasContact: true,
      }),
    ).toEqual([]);
  });
});
