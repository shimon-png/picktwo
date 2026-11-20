import { describe, expect, it } from "vitest";
import { profileIncomplete } from "@/lib/profile";
import { profileInput } from "@/lib/validators";

const base = { name: "Sam", handle: "sam_1", isAdultConfirmed: true as const, zipCode: "10001", sex: "FEMALE", ageRange: "AGE_25_34" };

describe("profileIncomplete", () => {
  const done = { onboardedAt: new Date(), zipCode: "10001", sex: "MALE", ageRange: "AGE_18_24" };
  it("is complete when onboarded with zip, sex and age", () => expect(profileIncomplete(done)).toBe(false));
  it.each(["onboardedAt", "zipCode", "sex", "ageRange"] as const)("is incomplete without %s", (k) =>
    expect(profileIncomplete({ ...done, [k]: null })).toBe(true),
  );
});

describe("profileInput required fields", () => {
  it("accepts a full profile", () => expect(profileInput.safeParse(base).success).toBe(true));
  it("accepts ZIP+4 and non-US postal codes", () => {
    for (const zipCode of ["10001-1234", "SW1A 1AA", "k1a 0b1"]) expect(profileInput.safeParse({ ...base, zipCode }).success).toBe(true);
  });
  it("rejects bad or missing ZIP", () => {
    for (const zipCode of ["", "1", "!!!!!", "12345678901"]) expect(profileInput.safeParse({ ...base, zipCode }).success).toBe(false);
    const noZip: Partial<typeof base> = { ...base };
    delete noZip.zipCode;
    expect(profileInput.safeParse(noZip).success).toBe(false);
  });
  it("requires sex from the allowed options", () => {
    expect(profileInput.safeParse({ ...base, sex: "UNDISCLOSED" }).success).toBe(true);
    expect(profileInput.safeParse({ ...base, sex: "" }).success).toBe(false);
    expect(profileInput.safeParse({ ...base, sex: "OTHER" }).success).toBe(false);
  });
  it("requires an age range", () => {
    expect(profileInput.safeParse({ ...base, ageRange: undefined }).success).toBe(false);
    expect(profileInput.safeParse({ ...base, ageRange: "AGE_12" }).success).toBe(false);
  });
});
