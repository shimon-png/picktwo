import { describe, expect, it } from "vitest";
import { handleBase, hashCode, newCode, normalizeEmail } from "@/server/services/signin-code-utils";

describe("sign-in codes", () => {
  it("are 6 digits", () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });
  it("hash per email, ignoring case and spaces", () => {
    expect(hashCode(" A@B.co ", "123456", "s")).toBe(hashCode("a@b.co", "123456", "s"));
    expect(hashCode("a@b.co", "123456", "s")).not.toBe(hashCode("c@b.co", "123456", "s"));
    expect(hashCode("a@b.co", "123456", "s")).not.toBe(hashCode("a@b.co", "123457", "s"));
    expect(normalizeEmail(" X@Y.Z ")).toBe("x@y.z");
  });
});

describe("handleBase", () => {
  it("derives a valid handle from an email", () => {
    expect(handleBase("Jane.Doe+cp@example.com")).toBe("janedoecp");
    expect(handleBase("ab@x.com")).toBe("ab_x");
    expect(handleBase("a@b.com")).toBe("a_b");
    expect(handleBase("a@1.io")).toBe("a_1");
    expect(handleBase("é@é.com")).toBe("user");
    expect(handleBase(null)).toBe("user");
    expect(handleBase("averyveryverylongname@x.com")).toHaveLength(15);
  });
});
