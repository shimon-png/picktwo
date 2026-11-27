import { describe, expect, it } from "vitest";
import { profileIncomplete } from "@/lib/profile";
import { profileInput } from "@/lib/validators";

const base = { name: "Sam", handle: "sam_1", isAdultConfirmed: true as const, zipCode: "10001", sex: "FEMALE", ageRange: "AGE_25_34" };

describe("profileIncomplete", () => {
  const done = { onboardedAt: new Date(), zipCode: "10001", sex: "MALE", ageRange: "AGE_18_24" };
  it("is complete when onboarded with zip, sex and age", () => expect(profileIncomplete(done)).toBe(false));
  it("is incomplete until sign-up finishes", () => expect(profileIncomplete({ ...done, onboardedAt: null })).toBe(true));
  // One-tap sign-up (Nov 25 2026): ZIP, sex and age are optional; the Vote deck asks for them later.
  it.each(["zipCode", "sex", "ageRange"] as const)("is still complete without %s", (k) => expect(profileIncomplete({ ...done, [k]: null })).toBe(false));
});

describe("profileInput fields", () => {
  it("accepts a full profile", () => expect(profileInput.safeParse(base).success).toBe(true));
  it("accepts ZIP+4 and non-US postal codes", () => {
    for (const zipCode of ["10001-1234", "SW1A 1AA", "k1a 0b1"]) expect(profileInput.safeParse({ ...base, zipCode }).success).toBe(true);
  });
  it("rejects a bad ZIP; a blank or missing one is fine (optional since Nov 25)", () => {
    for (const zipCode of ["1", "!!!!!", "12345678901"]) expect(profileInput.safeParse({ ...base, zipCode }).success).toBe(false);
    expect(profileInput.safeParse({ ...base, zipCode: "" }).success).toBe(true);
    const noZip: Partial<typeof base> = { ...base };
    delete noZip.zipCode;
    expect(profileInput.safeParse(noZip).success).toBe(true);
  });
  it("sex: one of the allowed options, or blank", () => {
    expect(profileInput.safeParse({ ...base, sex: "UNDISCLOSED" }).success).toBe(true);
    expect(profileInput.safeParse({ ...base, sex: "" }).success).toBe(true);
    expect(profileInput.safeParse({ ...base, sex: "OTHER" }).success).toBe(false);
  });
  it("age range: one of the bands, or left out", () => {
    expect(profileInput.safeParse({ ...base, ageRange: undefined }).success).toBe(true);
    expect(profileInput.safeParse({ ...base, ageRange: "AGE_12" }).success).toBe(false);
  });
});

describe("profileInput kids answer", () => {
  it("keeps No and Prefer not to say as separate answers", () => {
    expect(profileInput.parse({ ...base, kidsStatus: "NO" }).kidsStatus).toBe("NO");
    expect(profileInput.parse({ ...base, kidsStatus: "UNDISCLOSED" }).kidsStatus).toBe("UNDISCLOSED");
  });
  it("is optional but rejects unknown values", () => {
    expect(profileInput.safeParse({ ...base, kidsStatus: null }).success).toBe(true);
    expect(profileInput.safeParse({ ...base, kidsStatus: "MAYBE" }).success).toBe(false);
  });
});
