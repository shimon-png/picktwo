import { City, Country, State } from "country-state-city";

/**
 * Country → state/region → city lookups for the profile location pickers, backed by the
 * country-state-city dataset (server-only: the city list is ~8 MB, so it never ships to the browser).
 * Users store the country as its ISO-2 code, the region and city as names.
 */
export type GeoItem = { code: string; name: string };

let countryCache: GeoItem[] | null = null;

export function listCountries(): GeoItem[] {
  countryCache ??= Country.getAllCountries()
    .map((c) => ({ code: c.isoCode, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countryCache;
}

export function listStates(country: string): GeoItem[] {
  return State.getStatesOfCountry(country.toUpperCase())
    .map((s) => ({ code: s.isoCode, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function uniqSorted(names: string[]) {
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/** Cities of a state (by state name or code); countries without states list their cities directly. */
export function listCities(country: string, state?: string | null): string[] {
  const cc = country.toUpperCase();
  if (state) {
    const s = findState(cc, state);
    return s ? uniqSorted((City.getCitiesOfState(cc, s.code) ?? []).map((c) => c.name)) : [];
  }
  if (listStates(cc).length) return []; // pick a state first
  return uniqSorted((City.getCitiesOfCountry(cc) ?? []).map((c) => c.name));
}

export function findCountry(code: string): GeoItem | undefined {
  return listCountries().find((c) => c.code === code.toUpperCase());
}

export function findState(country: string, nameOrCode: string): GeoItem | undefined {
  const q = nameOrCode.trim().toLowerCase();
  return listStates(country).find((s) => s.name.toLowerCase() === q || s.code.toLowerCase() === q);
}

/**
 * Normalises a submitted location to real entities. Country must be a known code; region must be one of its
 * states (when it has any); city must be in the region's list (when the dataset has one). Unknown parts are
 * rejected with a message instead of being stored as free text.
 */
export function normalizeLocation(input: { country?: string; region?: string; city?: string }):
  | { ok: true; country: string | null; region: string | null; city: string | null }
  | { ok: false; message: string } {
  const country = input.country?.trim() ?? "";
  const region = input.region?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  if (!country) return { ok: true, country: null, region: null, city: null };
  const c = findCountry(country);
  if (!c) return { ok: false, message: "Pick a country from the list" };
  const states = listStates(c.code);
  let regionName: string | null = null;
  if (region) {
    if (states.length) {
      const s = findState(c.code, region);
      if (!s) return { ok: false, message: "Pick a state / region from the list" };
      regionName = s.name;
    } else regionName = null;
  }
  let cityName: string | null = null;
  if (city) {
    if (states.length && !regionName) return { ok: false, message: "Pick a state / region first" };
    const cities = listCities(c.code, regionName);
    if (cities.length) {
      const hit = cities.find((n) => n.toLowerCase() === city.toLowerCase());
      if (!hit) return { ok: false, message: "Pick a city from the list" };
      cityName = hit;
    } else cityName = city.slice(0, 60);
  }
  return { ok: true, country: c.code, region: regionName, city: cityName };
}
