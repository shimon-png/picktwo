/**
 * Passive signals for every visitor, no question asked (About-you plan §5, Nov 25 2026): IP region from Vercel's
 * geolocation headers, platform / browser / in-app browser from the user-agent, phone price tier from screen size
 * (iPhone) or the model client hint (Android), and an estimated income band from the ZIP area's Census median
 * income. Saved on the `device` row from the browser's first real visit; pure rules in passive-rules.ts.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { devices, zipIncome } from "../db/schema";
import { deviceTier, parseAcsZipRows, parseDevice, screenKey, type Platform } from "./passive-rules";

export type Geo = { country: string | null; region: string | null; city: string | null; zip: string | null };
type StartProps = { sw?: unknown; sh?: unknown; dpr?: unknown; mem?: unknown };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** What `session_start` gains on the server: parsed device facts + IP geo (also returned for the event props). */
export function startFacts(ua: string, geo: Geo, props: StartProps) {
  const d = parseDevice(ua);
  const screen = screenKey(num(props.sw), num(props.sh), num(props.dpr));
  const tier = deviceTier({ platform: d.platform, tablet: d.tablet, screenW: num(props.sw), screenH: num(props.sh), dpr: num(props.dpr), memoryGb: num(props.mem) });
  return { device: { platform: d.platform, os: d.osVersion, browser: d.browser, inApp: d.inApp, tier, screen }, geo };
}

/**
 * Save a browser's passive facts on its `device` row. Geo and screen keep the FIRST real visit's values (a later
 * visit from work shouldn't move someone); platform, browser and tier refresh. Never throws.
 */
export async function recordDevice(deviceId: string, facts: ReturnType<typeof startFacts>) {
  const { device: d, geo } = facts;
  try {
    await db
      .insert(devices)
      .values({
        id: deviceId,
        ipCountry: geo.country,
        ipRegion: geo.region,
        ipCity: geo.city,
        ipZip: geo.zip,
        platform: d.platform,
        browser: d.browser,
        inApp: d.inApp,
        screen: d.screen,
        tier: d.tier,
        seenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: devices.id,
        set: {
          ipCountry: sql`COALESCE(${devices.ipCountry}, excluded.ip_country)`,
          ipRegion: sql`COALESCE(${devices.ipRegion}, excluded.ip_region)`,
          ipCity: sql`COALESCE(${devices.ipCity}, excluded.ip_city)`,
          ipZip: sql`COALESCE(${devices.ipZip}, excluded.ip_zip)`,
          platform: sql`excluded.platform`,
          browser: sql`excluded.browser`,
          inApp: sql`COALESCE(excluded.in_app, ${devices.inApp})`,
          screen: sql`COALESCE(${devices.screen}, excluded.screen)`,
          // A model hint (Android) beats a screen guess; keep a known tier over "unknown".
          tier: sql`CASE WHEN ${devices.model} IS NOT NULL OR excluded.tier = 'unknown' THEN COALESCE(${devices.tier}, excluded.tier) ELSE excluded.tier END`,
          seenAt: sql`excluded.seen_at`,
        },
      });
  } catch (e) {
    console.error("[passive] device", e);
  }
}

/** Android Chrome's model client hint (`device_hints` event) → model + a better tier. */
export async function recordDeviceHints(deviceId: string, hints: { model?: unknown; mem?: unknown }) {
  const model = typeof hints.model === "string" ? hints.model.trim().slice(0, 40) : "";
  if (!model) return;
  try {
    const [d] = await db.select({ platform: devices.platform }).from(devices).where(eq(devices.id, deviceId));
    const tier = deviceTier({ platform: (d?.platform as Platform) ?? "android", model, memoryGb: num(hints.mem) });
    await db
      .insert(devices)
      .values({ id: deviceId, model, tier, platform: d?.platform ?? "android", seenAt: new Date() })
      .onConflictDoUpdate({ target: devices.id, set: { model, tier } });
  } catch (e) {
    console.error("[passive] hints", e);
  }
}

// ---------- Census income by ZIP ----------
const ACS_YEAR = 2022;

/**
 * Load (or refresh) the Census ACS 5-year median household income + renter share for every US ZIP area into
 * `zip_income`: one request, ~33,000 rows. Runs from the daily cron when the table is empty, or from the Brain
 * page's button. `CENSUS_API_KEY` is optional (keyless calls are rate-limited but one call a day is fine).
 */
export async function loadZipIncome(): Promise<{ loaded: number; year: number; error?: string }> {
  const key = process.env.CENSUS_API_KEY ? `&key=${encodeURIComponent(process.env.CENSUS_API_KEY)}` : "";
  const url = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=B19013_001E,B25003_001E,B25003_003E&for=zip%20code%20tabulation%20area:*${key}`;
  let json: unknown;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { loaded: 0, year: ACS_YEAR, error: `Census API ${res.status}` };
    json = await res.json();
  } catch (e) {
    return { loaded: 0, year: ACS_YEAR, error: (e as Error).message };
  }
  const rows = parseAcsZipRows(json);
  for (let i = 0; i < rows.length; i += 2000) {
    const chunk = rows.slice(i, i + 2000).map((r) => ({ ...r, year: ACS_YEAR }));
    await db
      .insert(zipIncome)
      .values(chunk)
      .onConflictDoUpdate({
        target: zipIncome.zip,
        set: { medianIncome: sql`excluded.median_income`, renterPct: sql`excluded.renter_pct`, year: sql`excluded.year` },
      });
  }
  return { loaded: rows.length, year: ACS_YEAR };
}

/** Daily cron: fill the table once (it's a 5-year survey, so no need to refetch daily). */
export async function ensureZipIncome() {
  const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM zip_income`);
  if (Number(r?.n ?? 0) > 1000) return { skipped: true, rows: Number(r?.n) };
  return loadZipIncome();
}
