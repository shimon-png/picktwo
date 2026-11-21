import zipcodes from "zipcodes";
import { findState, listCities } from "./geo";

/**
 * Real ZIP / postal code checks, backed by the `zipcodes` dataset (every US ZIP + Canadian FSAs).
 * Server-only: the dataset is ~5 MB.
 *
 * - US: 5-digit ZIP (ZIP+4 accepted, stored as the 5-digit ZIP) that exists in the dataset.
 * - Canada: full postal code "A1A 1A1" whose first three characters (FSA) exist.
 * - Other countries (only when the profile's country is set to one): format check only.
 */
export type ZipInfo = { code: string; country: string; region: string | null; city: string | null };
export type ZipResult = ({ ok: true } & ZipInfo) | { ok: false; message: string };

const US_RE = /^(\d{5})(?:-?\d{4})?$/;
const CA_RE = /^([A-Z]\d[A-Z]) ?(\d[A-Z]\d)$/;
const OTHER_RE = /^[A-Z0-9][A-Z0-9 -]{1,8}[A-Z0-9]$/;
export const ZIP_MESSAGE = "Enter a real US ZIP code (or Canadian postal code)";

const clean = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

function cityIfKnown(country: string, region: string | null, city: string): string | null {
  if (!region) return null;
  const list = listCities(country, region);
  const want = [city, `${city} City`].map((c) => c.toLowerCase()); // "New York" is "New York City" in the city list
  return want.map((w) => list.find((c) => c.toLowerCase() === w)).find(Boolean) ?? null;
}

export function lookupZip(raw: string, country?: string | null): ZipResult {
  const s = clean(raw);
  const us = US_RE.exec(s);
  if (us) {
    const z = zipcodes.lookup(us[1]);
    if (!z || z.country !== "US") return { ok: false, message: "That ZIP code doesn’t exist" };
    const region = findState("US", z.state)?.name ?? null;
    return { ok: true, code: us[1], country: "US", region, city: cityIfKnown("US", region, z.city) };
  }
  const ca = CA_RE.exec(s);
  if (ca) {
    const z = zipcodes.lookup(ca[1]);
    if (!z || z.country !== "Canada") return { ok: false, message: "That postal code doesn’t exist" };
    return { ok: true, code: `${ca[1]} ${ca[2]}`, country: "CA", region: findState("CA", z.state)?.name ?? null, city: null };
  }
  const cc = country?.toUpperCase();
  if (cc && cc !== "US" && cc !== "CA" && OTHER_RE.test(s)) return { ok: true, code: s, country: cc, region: null, city: null };
  return { ok: false, message: ZIP_MESSAGE };
}

let prefixes: Set<string> | null = null;
function usPrefixes() {
  if (!prefixes) {
    prefixes = new Set();
    for (const [code, z] of Object.entries(zipcodes.codes)) {
      if (z.country !== "US" || !/^\d{5}$/.test(code)) continue;
      prefixes.add(code.slice(0, 3)).add(code.slice(0, 4));
    }
  }
  return prefixes;
}

/**
 * Composer targeting entries: a full ZIP / postal code, or a prefix that real codes start with
 * ("941" = San Francisco area, "M5V" = a Canadian FSA). Returns the normalised entry or null.
 */
export function checkZipTarget(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^\d{3,4}$/.test(s)) return usPrefixes().has(s) ? s : null;
  if (/^\d{5}$/.test(s)) return zipcodes.lookup(s)?.country === "US" ? s : null;
  if (/^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(s)) return zipcodes.lookup(s.slice(0, 3))?.country === "Canada" ? s : null;
  return null;
}
