"use client";
import { useEffect, useState } from "react";

type Item = { code: string; name: string };
export type LocationValue = { country: string; region: string; city: string };

const cache = new Map<string, unknown>();
async function geo<T>(qs: string): Promise<T> {
  if (cache.has(qs)) return cache.get(qs) as T;
  const res = await fetch(`/api/geo?${qs}`);
  if (!res.ok) throw new Error("Couldn’t load places");
  const { items } = (await res.json()) as { items: T };
  cache.set(qs, items);
  return items;
}

/**
 * Country → State / region → City pickers with real places (served by /api/geo).
 * Country and state are selects; the city is a type-ahead (datalist) because some states have 1,000+ cities.
 * Countries without states skip straight to cities; places with no city list fall back to free text.
 */
export function LocationFields({ value, onChange }: { value: LocationValue; onChange: (v: LocationValue) => void }) {
  const [countries, setCountries] = useState<Item[]>([]);
  const [states, setStates] = useState<Item[] | null>(null);
  const [cities, setCities] = useState<string[] | null>(null);
  const { country, region, city } = value;

  useEffect(() => {
    geo<Item[]>("level=countries")
      .then((list) => {
        setCountries(list);
        // Older profiles may hold a country name instead of its code.
        if (country && !list.some((c) => c.code === country.toUpperCase())) {
          const hit = list.find((c) => c.name.toLowerCase() === country.trim().toLowerCase());
          onChange({ country: hit?.code ?? "", region: "", city: "" });
        } else if (country && country !== country.toUpperCase()) onChange({ ...value, country: country.toUpperCase() });
      })
      .catch(() => setCountries([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setStates(null);
    if (!country) return;
    let live = true;
    geo<Item[]>(`level=states&country=${encodeURIComponent(country)}`)
      .then((list) => {
        if (!live) return;
        setStates(list);
        // Free-text region from before this picker existed: keep it only if it names a real state.
        if (region && list.length && !list.some((s) => s.name === region)) {
          const hit = list.find((s) => s.name.toLowerCase() === region.toLowerCase() || s.code.toLowerCase() === region.toLowerCase());
          onChange({ country, region: hit?.name ?? "", city: hit ? city : "" });
        }
      })
      .catch(() => live && setStates([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const needsState = !!states && states.length > 0;
  const cityKey = country && states && (!needsState || region) ? `level=cities&country=${encodeURIComponent(country)}${needsState ? `&state=${encodeURIComponent(region)}` : ""}` : null;

  useEffect(() => {
    setCities(null);
    if (!cityKey) return;
    let live = true;
    geo<string[]>(cityKey)
      .then((list) => live && setCities(list))
      .catch(() => live && setCities([]));
    return () => {
      live = false;
    };
  }, [cityKey]);

  const cityInvalid = !!city && !!cities?.length && !cities.some((c) => c.toLowerCase() === city.trim().toLowerCase());

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor="country">
          Country <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <select
          id="country"
          className="input"
          value={country.toUpperCase()}
          onChange={(e) => onChange({ country: e.target.value, region: "", city: "" })}
          autoComplete="country"
        >
          <option value="">{countries.length ? "Choose…" : "Loading…"}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {(!states || needsState) && (
        <div>
          <label className="label" htmlFor="region">
            State / region
          </label>
          <select
            id="region"
            className="input"
            value={region}
            disabled={!country || !states}
            onChange={(e) => onChange({ country, region: e.target.value, city: "" })}
            autoComplete="address-level1"
          >
            <option value="">{!country ? "Pick a country first" : !states ? "Loading…" : "Choose…"}</option>
            {states?.map((s) => (
              <option key={s.code} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="city">
          City
        </label>
        <input
          id="city"
          className="input"
          list={cities?.length ? "city-options" : undefined}
          maxLength={80}
          value={city}
          disabled={!cityKey || cities === null}
          placeholder={!country ? "Pick a country first" : needsState && !region ? "Pick a state first" : cities === null ? "Loading…" : "Start typing…"}
          onChange={(e) => onChange({ country, region, city: e.target.value })}
          onBlur={() => {
            // Snap to the canonical spelling when it matches a listed city.
            const hit = cities?.find((c) => c.toLowerCase() === city.trim().toLowerCase());
            if (hit && hit !== city) onChange({ country, region, city: hit });
          }}
          aria-invalid={cityInvalid}
          autoComplete="address-level2"
        />
        {!!cities?.length && (
          <datalist id="city-options">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
        {cityInvalid && <p className="mt-1 text-xs text-b">Pick a city from the list</p>}
      </div>
    </div>
  );
}
