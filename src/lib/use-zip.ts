"use client";
import { useEffect, useState } from "react";

export type ZipCheck =
  | { state: "empty" | "checking" }
  | { state: "ok"; code: string; country: string; region: string | null; city: string | null }
  | { state: "bad"; message: string };

const cache = new Map<string, ZipCheck>();

/** Checks a ZIP / postal code against the real dataset (GET /api/geo?level=zip), debounced. */
export function useZipCheck(zip: string, country?: string | null): ZipCheck {
  const value = zip.trim().toUpperCase();
  const key = `${value}|${country ?? ""}`;
  const [res, setRes] = useState<ZipCheck>(() => (value ? (cache.get(key) ?? { state: "checking" }) : { state: "empty" }));

  useEffect(() => {
    if (!value) return setRes({ state: "empty" });
    const hit = cache.get(key);
    if (hit) return setRes(hit);
    setRes({ state: "checking" });
    let live = true;
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ level: "zip", code: value, ...(country ? { country } : {}) });
        const r = await fetch(`/api/geo?${qs}`).then((x) => x.json());
        const out: ZipCheck = r.ok ? { state: "ok", code: r.code, country: r.country, region: r.region, city: r.city } : { state: "bad", message: r.message ?? r.error?.message ?? "Enter a real ZIP code" };
        cache.set(key, out);
        if (live) setRes(out);
      } catch {
        if (live) setRes({ state: "bad", message: "Couldn’t check that ZIP — try again" });
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [key, value, country]);

  return res;
}

/** Composer targeting: which of these entries aren't real ZIP codes / prefixes. */
export function useZipTargets(codes: string[]): { checking: boolean; invalid: string[] } {
  const key = codes.join(",");
  const [state, setState] = useState<{ checking: boolean; invalid: string[] }>({ checking: false, invalid: [] });
  useEffect(() => {
    if (!key) return setState({ checking: false, invalid: [] });
    setState((s) => ({ ...s, checking: true }));
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geo?level=zipTargets&codes=${encodeURIComponent(key)}`).then((x) => x.json());
        if (live) setState({ checking: false, invalid: r.invalid ?? [] });
      } catch {
        if (live) setState({ checking: false, invalid: [] });
      }
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [key]);
  return state;
}
