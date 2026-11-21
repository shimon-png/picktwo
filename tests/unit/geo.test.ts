import { describe, expect, it } from "vitest";
import { listCities, listStates, normalizeLocation } from "@/server/services/geo";

describe("geo lookups", () => {
  it("lists states and cities", () => {
    expect(listStates("US").some((s) => s.name === "New York")).toBe(true);
    expect(listCities("US", "New York")).toContain("Brooklyn");
    expect(listCities("US", "NY")).toContain("Brooklyn");
    expect(listCities("US")).toEqual([]); // needs a state first
  });
});

describe("normalizeLocation", () => {
  it("accepts real entities and canonicalises case", () => {
    expect(normalizeLocation({ country: "us", region: "new york", city: "brooklyn" })).toEqual({
      ok: true,
      country: "US",
      region: "New York",
      city: "Brooklyn",
    });
  });
  it("allows partial and empty locations", () => {
    expect(normalizeLocation({})).toEqual({ ok: true, country: null, region: null, city: null });
    expect(normalizeLocation({ country: "CA" })).toEqual({ ok: true, country: "CA", region: null, city: null });
  });
  it("rejects made-up values", () => {
    expect(normalizeLocation({ country: "Narnia" }).ok).toBe(false);
    expect(normalizeLocation({ country: "US", region: "Atlantis" }).ok).toBe(false);
    expect(normalizeLocation({ country: "US", region: "New York", city: "Gotham" }).ok).toBe(false);
    expect(normalizeLocation({ country: "US", city: "Brooklyn" }).ok).toBe(false);
  });
});
