import { describe, expect, it } from "vitest";
import { checkZipTarget, lookupZip } from "@/server/services/zip";

describe("lookupZip", () => {
  it("accepts real US ZIPs and fills the place", () => {
    expect(lookupZip("10001")).toMatchObject({ ok: true, code: "10001", country: "US", region: "New York" });
    const r = lookupZip(" 94110-1234 ");
    expect(r.ok && r.code).toBe("94110");
    expect(r.ok && r.region).toBe("California");
  });
  it("rejects made-up ZIPs and junk", () => {
    expect(lookupZip("00000").ok).toBe(false);
    expect(lookupZip("99999").ok).toBe(false);
    expect(lookupZip("abc").ok).toBe(false);
    expect(lookupZip("1234").ok).toBe(false);
  });
  it("accepts real Canadian postal codes", () => {
    expect(lookupZip("m5v2t6")).toMatchObject({ ok: true, code: "M5V 2T6", country: "CA", region: "Ontario" });
    expect(lookupZip("Z9Z 9Z9").ok).toBe(false);
  });
  it("only allows other formats when the profile country is elsewhere", () => {
    expect(lookupZip("SW1A 1AA").ok).toBe(false);
    expect(lookupZip("SW1A 1AA", "GB")).toMatchObject({ ok: true, country: "GB" });
  });
});

describe("checkZipTarget", () => {
  it("allows real ZIPs and prefixes", () => {
    expect(checkZipTarget("941")).toBe("941");
    expect(checkZipTarget("1000")).toBe("1000");
    expect(checkZipTarget("10001")).toBe("10001");
    expect(checkZipTarget("m5v")).toBe("M5V");
  });
  it("rejects fake ones", () => {
    expect(checkZipTarget("000")).toBeNull();
    expect(checkZipTarget("99999")).toBeNull();
    expect(checkZipTarget("hello")).toBeNull();
  });
});
