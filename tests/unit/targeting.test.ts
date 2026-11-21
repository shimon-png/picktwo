import { describe, it, expect } from "vitest";
import { cleanTarget, matchesTarget, normalizeZip, type TargetViewer } from "@/server/services/targeting";

const mom: TargetViewer = { zipCode: "94110", kidsStatus: "YES", kidAges: ["AGE_5_8"], ageRange: "AGE_25_34", sex: "FEMALE" };
const guy: TargetViewer = { zipCode: "10001-1234", kidsStatus: "NO", kidAges: [], ageRange: "AGE_18_24", sex: "MALE" };

describe("battle targeting", () => {
  it("untargeted battles reach everyone, incl. signed-out viewers", () => {
    expect(matchesTarget(undefined, null)).toBe(true);
    expect(matchesTarget({}, guy)).toBe(true);
    expect(matchesTarget({ zips: [], ageRanges: [], sexes: ["MALE", "FEMALE"] }, null)).toBe(true);
  });
  it("targeted battles skip signed-out viewers", () => {
    expect(matchesTarget({ sexes: ["FEMALE"] }, null)).toBe(false);
  });
  it("matches ZIPs exactly or by prefix", () => {
    expect(matchesTarget({ zips: ["94110"] }, mom)).toBe(true);
    expect(matchesTarget({ zips: ["941"] }, mom)).toBe(true);
    expect(matchesTarget({ zips: ["10001"] }, guy)).toBe(true);
    expect(matchesTarget({ zips: ["10001"] }, mom)).toBe(false);
    expect(matchesTarget({ zips: ["941"] }, { ...mom, zipCode: null })).toBe(false);
  });
  it("parents / not parents and kid ages", () => {
    expect(matchesTarget({ parents: "YES" }, mom)).toBe(true);
    expect(matchesTarget({ parents: "YES" }, guy)).toBe(false);
    expect(matchesTarget({ parents: "NO" }, guy)).toBe(true);
    expect(matchesTarget({ parents: "NO" }, mom)).toBe(false);
    expect(matchesTarget({ parents: "NO" }, { ...guy, kidsStatus: "UNDISCLOSED" })).toBe(false);
    expect(matchesTarget({ parents: "YES", kidAges: ["AGE_5_8", "AGE_9_12"] }, mom)).toBe(true);
    expect(matchesTarget({ parents: "YES", kidAges: ["AGE_13_17"] }, mom)).toBe(false);
  });
  it("age ranges are multi-select and sex filters", () => {
    expect(matchesTarget({ ageRanges: ["AGE_18_24", "AGE_25_34"] }, mom)).toBe(true);
    expect(matchesTarget({ ageRanges: ["AGE_35_44"] }, mom)).toBe(false);
    expect(matchesTarget({ sexes: ["MALE"] }, mom)).toBe(false);
    expect(matchesTarget({ sexes: ["FEMALE"] }, { ...mom, sex: "UNDISCLOSED" })).toBe(false);
  });
  it("all set dimensions must match", () => {
    expect(matchesTarget({ parents: "YES", sexes: ["FEMALE"], zips: ["941"] }, mom)).toBe(true);
    expect(matchesTarget({ parents: "YES", sexes: ["MALE"], zips: ["941"] }, mom)).toBe(false);
  });
  it("cleanTarget drops empty filters and kid ages without parents", () => {
    expect(cleanTarget({ zips: [" ", "1"], ageRanges: [] })).toBeUndefined();
    expect(cleanTarget({ parents: "NO", kidAges: ["AGE_0_2"] })).toEqual({ parents: "NO" });
    expect(cleanTarget({ zips: ["941 10", "941 10"] })).toEqual({ zips: ["94110"] });
    expect(normalizeZip("sw1a 1aa")).toBe("SW1A1AA");
  });
});
