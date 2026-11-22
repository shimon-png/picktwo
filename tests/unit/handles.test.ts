import { describe, expect, it } from "vitest";
import { generateHandle, namePart } from "@/lib/handles";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

describe("generateHandle", () => {
  it("always makes a valid username", () => {
    for (let i = 0; i < 2000; i++) expect(generateHandle()).toMatch(HANDLE_RE);
    for (let i = 0; i < 500; i++) expect(generateHandle({ name: "Alexandra" })).toMatch(HANDLE_RE);
  });

  it("uses the given name", () => {
    expect(generateHandle({ name: "mia", rand: () => 0.5 })).toMatch(/_mia$/);
  });

  it("is deterministic with a seeded random", () => {
    const r = () => 0.1;
    expect(generateHandle({ rand: r })).toBe(generateHandle({ rand: r }));
  });
});

describe("namePart", () => {
  it("takes the leading letters of the email", () => {
    expect(namePart("jessica.lee@x.com")).toBe("jessic");
    expect(namePart("Mo@x.com")).toBe("mo");
  });
  it("returns empty when there's no usable name", () => {
    expect(namePart("123abc@x.com")).toBe("");
    expect(namePart(null)).toBe("");
    expect(namePart("a@x.com")).toBe("");
  });
});
