/**
 * Passive signals, pure rules (tested in tests/unit/passive.test.ts). Everything here is an estimate used only for
 * weighting and group-level brand panels, never shown to the person or anyone else.
 */

export type Platform = "ios" | "android" | "desktop" | "other";
export type Tier = "budget" | "mid" | "flagship" | "desktop" | "unknown";
export type IncomeBand = "lower" | "middle" | "upper";

export type ParsedDevice = { platform: Platform; osVersion: string | null; browser: string; inApp: string | null; tablet: boolean };

/** In-app browsers mark their user-agent; it also says where the visit came from. First match wins. */
const IN_APP: [RegExp, string][] = [
  [/Twitter(Android)?\b|TwitterAndroid/i, "x"],
  [/Instagram/i, "instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "facebook"],
  [/musical_ly|BytedanceWebview|TikTok|trill_/i, "tiktok"],
  [/Snapchat/i, "snapchat"],
  [/Pinterest/i, "pinterest"],
  [/LinkedInApp/i, "linkedin"],
  [/Reddit/i, "reddit"],
  [/GSA\//, "google_app"],
];

export function parseDevice(ua: string): ParsedDevice {
  const s = ua || "";
  const inApp = IN_APP.find(([re]) => re.test(s))?.[1] ?? null;
  const ipad = /iPad/.test(s);
  let platform: Platform = "other";
  let osVersion: string | null = null;
  if (/iPhone|iPod|iPad/.test(s)) {
    platform = "ios";
    const m = s.match(/OS (\d+)[_.](\d+)/);
    osVersion = m ? `${m[1]}.${m[2]}` : null;
  } else if (/Android/.test(s)) {
    platform = "android";
    osVersion = s.match(/Android (\d+(?:\.\d+)?)/)?.[1] ?? null;
  } else if (/Windows|Macintosh|X11|CrOS|Linux x86_64/.test(s)) {
    platform = "desktop";
  }
  const browser = /CriOS/.test(s)
    ? "chrome"
    : /FxiOS|Firefox\//.test(s)
      ? "firefox"
      : /EdgiOS|EdgA|Edg\//.test(s)
        ? "edge"
        : /SamsungBrowser/.test(s)
          ? "samsung"
          : /OPR\/|Opera/.test(s)
            ? "opera"
            : /Chrome\//.test(s)
              ? "chrome"
              : /Safari\//.test(s)
                ? "safari"
                : "other";
  return { platform, osVersion, browser, inApp, tablet: ipad || (platform === "android" && !/Mobile/.test(s)) };
}

/**
 * iPhone classes by portrait screen (CSS px) and pixel density. Apple hides the model, so this is a class, not a
 * phone: newest Pro Max / Plus and 16 Pro = flagship; recent standard / Pro and older Pro Max = mid; SE, 8 and
 * XR / 11 = budget or old.
 */
const IPHONE_SCREENS: [string, Tier][] = [
  ["440x956@3", "flagship"], // 16 Pro Max, 17 Pro Max
  ["430x932@3", "flagship"], // 14 Pro Max, 15 Plus / Pro Max, 16 Plus
  ["402x874@3", "flagship"], // 16 Pro, 17 Pro
  ["393x852@3", "mid"], // 14 Pro, 15, 15 Pro, 16
  ["390x844@3", "mid"], // 12, 13, 14, 16e
  ["428x926@3", "mid"], // 12 / 13 Pro Max, 14 Plus
  ["375x812@3", "mid"], // X, XS, 11 Pro, 12 / 13 mini
  ["414x896@3", "mid"], // XS Max, 11 Pro Max
  ["414x896@2", "budget"], // XR, 11
  ["414x736@3", "budget"], // 6s–8 Plus
  ["375x667@2", "budget"], // SE 2/3, 6s–8
  ["320x568@2", "budget"], // SE 1
];

/** Android models from client hints ("SM-S928U" = Galaxy S24 Ultra). First match wins. */
const ANDROID_MODELS: [RegExp, Tier][] = [
  [/^SM-S9\d\d/i, "flagship"], // Galaxy S2x
  [/^SM-F9\d\d|^SM-F7\d\d/i, "flagship"], // Z Fold / Flip
  [/^SM-N9\d\d/i, "flagship"], // Note
  [/^Pixel \d+a\b/i, "mid"],
  [/^Pixel (?:[7-9]|\d{2})\b|^Pixel \d+ Pro/i, "flagship"],
  [/^Pixel/i, "mid"],
  [/^SM-A[5-9]\d/i, "mid"], // Galaxy A5x–A9x
  [/^SM-A[0-4]\d|^SM-M\d|^SM-E\d/i, "budget"],
  [/^moto g|^moto e/i, "budget"],
  [/^motorola edge|^moto edge|^razr/i, "mid"],
  [/^(CPH|PH[A-Z]\d|LE\d|NE\d)/i, "mid"], // OnePlus / Oppo
  [/^(Redmi|2201|2211|M2\d)/i, "budget"], // Xiaomi Redmi
];

export type TierInput = { platform: Platform; tablet?: boolean; screenW?: number | null; screenH?: number | null; dpr?: number | null; model?: string | null; memoryGb?: number | null };

export function screenKey(w?: number | null, h?: number | null, dpr?: number | null): string | null {
  if (!w || !h) return null;
  const a = Math.round(Math.min(w, h));
  const b = Math.round(Math.max(w, h));
  return `${a}x${b}@${dpr ? Math.round(dpr) : 1}`;
}

/** Phone price tier: budget / mid / flagship (desktop and unknown kept apart). */
export function deviceTier(d: TierInput): Tier {
  if (d.platform === "desktop") return "desktop";
  if (d.platform === "ios") {
    if (d.tablet || (Math.min(d.screenW ?? 0, d.screenH ?? 0) >= 744)) return "mid"; // iPad
    const key = screenKey(d.screenW, d.screenH, d.dpr);
    return (key && IPHONE_SCREENS.find(([k]) => k === key)?.[1]) || "unknown";
  }
  if (d.platform === "android") {
    const m = (d.model ?? "").trim();
    if (m) {
      const hit = ANDROID_MODELS.find(([re]) => re.test(m));
      if (hit) return hit[1];
    }
    // Chrome reports memory rounded and capped at 8 GB.
    if (d.memoryGb != null) return d.memoryGb >= 8 ? "flagship" : d.memoryGb >= 4 ? "mid" : "budget";
    return "unknown";
  }
  return "unknown";
}

/** US median household income is about $75k (ACS 2018–2022); bands around it. */
export const INCOME_LOWER_BELOW = 55_000;
export const INCOME_UPPER_FROM = 100_000;

/**
 * Estimated household income band from the ZIP area's median income, nudged by phone tier: a flagship phone in a
 * middle-income ZIP stays middle, but tips a borderline (within 15%) area up; a budget phone tips it down.
 * No ZIP income → null (a phone alone says too little).
 */
export function incomeBand(zipMedian: number | null | undefined, tier: Tier | null | undefined): IncomeBand | null {
  if (zipMedian == null || !Number.isFinite(zipMedian) || zipMedian <= 0) return null;
  const nudge = tier === "flagship" ? 1.15 : tier === "budget" ? 0.87 : 1;
  const x = zipMedian * nudge;
  return x < INCOME_LOWER_BELOW ? "lower" : x >= INCOME_UPPER_FROM ? "upper" : "middle";
}

/**
 * Census ACS API rows → ZIP rows. Input: [[header…], [income, households, renters, zcta], …] from
 * `get=B19013_001E,B25003_001E,B25003_003E&for=zip code tabulation area:*`. Census marks missing values with large
 * negative numbers (-666666666), which become null.
 */
export function parseAcsZipRows(json: unknown): { zip: string; medianIncome: number | null; renterPct: number | null }[] {
  if (!Array.isArray(json) || json.length < 2) return [];
  const head = (json[0] as string[]).map(String);
  const iInc = head.indexOf("B19013_001E");
  const iTot = head.indexOf("B25003_001E");
  const iRent = head.indexOf("B25003_003E");
  const iZip = head.findIndex((h) => h.toLowerCase().startsWith("zip code tabulation area"));
  if (iInc < 0 || iZip < 0) return [];
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const out: { zip: string; medianIncome: number | null; renterPct: number | null }[] = [];
  for (const r of json.slice(1) as unknown[][]) {
    const zip = String(r[iZip] ?? "");
    if (!/^\d{5}$/.test(zip)) continue;
    const tot = iTot >= 0 ? num(r[iTot]) : null;
    const rent = iRent >= 0 ? num(r[iRent]) : null;
    out.push({ zip, medianIncome: num(r[iInc]), renterPct: tot && rent != null ? Math.round((1000 * rent) / tot) / 1000 : null });
  }
  return out;
}

/** Vercel IP geolocation headers → a small object (city is URI-encoded by Vercel). Empty values → null. */
export function geoFromHeaders(get: (name: string) => string | null): { country: string | null; region: string | null; city: string | null; zip: string | null } {
  const v = (n: string) => {
    const x = get(n);
    if (!x) return null;
    try {
      return decodeURIComponent(x).slice(0, 80) || null;
    } catch {
      return x.slice(0, 80);
    }
  };
  return { country: v("x-vercel-ip-country"), region: v("x-vercel-ip-country-region"), city: v("x-vercel-ip-city"), zip: v("x-vercel-ip-postal-code") };
}

export type GroupRow = { key: string; visitors: number; voted: number; signedUp: number };

/** Count people per value, with how many voted / have an account. Sorted by visitors, biggest first. */
export function groupPeople<T>(people: T[], keyOf: (p: T) => string, voted: (p: T) => boolean, signed: (p: T) => boolean): GroupRow[] {
  const by = new Map<string, GroupRow>();
  for (const p of people) {
    const k = keyOf(p);
    const r = by.get(k) ?? { key: k, visitors: 0, voted: 0, signedUp: 0 };
    r.visitors++;
    if (voted(p)) r.voted++;
    if (signed(p)) r.signedUp++;
    by.set(k, r);
  }
  return [...by.values()].sort((a, b) => b.visitors - a.visitors);
}

