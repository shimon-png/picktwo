import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../db";
import {
  PLANS,
  monthWindow,
  neonCost,
  perUnit,
  projectMonthEnd,
  round2,
  sumFocusRows,
  sumOpenAiCosts,
  type ProviderId,
} from "./finance-rules";

/**
 * /admin/finance: live spend per provider. Each provider is fetched with a short timeout and cached for
 * 15 minutes (Next fetch cache), so opening the page costs nothing against provider rate limits and the
 * DB part is two counts cached the same way. A provider without its token shows list price + "connect".
 */

const CACHE_S = 900;
const VERCEL_INCLUDED_CREDIT = 20;

export type Live =
  | { state: "live"; mtd: number; projected: number; detail: { name: string; cost: number }[]; note?: string }
  | { state: "connect"; missing: string[] }
  | { state: "error"; message: string }
  | { state: "none" };

export type ProviderRow = (typeof PLANS)[number] & { live: Live; mtd: number; projected: number };

async function getJson(url: string, token: string, asText = false) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: CACHE_S },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  return asText ? res.text() : res.json();
}

const missing = (vars: string[]) => vars.filter((v) => !process.env[v]);

async function vercel(now: Date): Promise<Live> {
  const need = missing(["VERCEL_TOKEN", "VERCEL_TEAM_ID"]);
  if (need.length) return { state: "connect", missing: need };
  const { start } = monthWindow(now);
  // `to` is exclusive and day-granular: ask through tomorrow so today's partial day is included.
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const qs = new URLSearchParams({ from: start.toISOString(), to: to.toISOString(), teamId: process.env.VERCEL_TEAM_ID! });
  const url = (q: URLSearchParams) => `https://api.vercel.com/v1/billing/charges?${q}`;
  let text: string;
  try {
    text = (await getJson(url(qs), process.env.VERCEL_TOKEN!, true)) as string;
  } catch (e) {
    // Some ranges reaching past "now" are refused; fall back to ending at the current moment.
    if (!(e instanceof Error) || !e.message.startsWith("400")) throw e;
    qs.set("to", now.toISOString());
    text = (await getJson(url(qs), process.env.VERCEL_TOKEN!, true)) as string;
  }
  const f = sumFocusRows(text);
  const usageProjected = projectMonthEnd(f.usage, now);
  const overCredit = (n: number) => Math.max(0, n - VERCEL_INCLUDED_CREDIT);
  // The Pro seat may or may not appear as a Purchase row; count the $20 once either way.
  const fixed = Math.max(20, f.other);
  return {
    state: "live",
    mtd: round2(fixed + overCredit(f.usage)),
    projected: round2(fixed + overCredit(usageProjected)),
    detail: f.services,
    note: `Usage so far $${f.usage.toFixed(2)} (pace $${usageProjected.toFixed(2)}); the first $${VERCEL_INCLUDED_CREDIT} is covered by Pro.`,
  };
}

async function neon(now: Date): Promise<Live> {
  const need = missing(["NEON_API_KEY", "NEON_PROJECT_ID"]);
  if (need.length) return { state: "connect", missing: need };
  const j = (await getJson(
    `https://console.neon.tech/api/v2/projects/${encodeURIComponent(process.env.NEON_PROJECT_ID!)}`,
    process.env.NEON_API_KEY!,
  )) as { project?: Record<string, number | string | undefined> };
  const p = j.project ?? {};
  const c = neonCost({
    computeSeconds: Number(p.compute_time_seconds ?? 0),
    storageByteHours: Number(p.data_storage_bytes_hour ?? 0),
    transferBytes: Number(p.data_transfer_bytes ?? 0),
  });
  // Neon's period can start mid-month (plan change), so project from its own start date.
  const periodStart = p.consumption_period_start ? new Date(String(p.consumption_period_start)) : monthWindow(now).start;
  const { end } = monthWindow(now);
  const elapsed = Math.max((now.getTime() - periodStart.getTime()) / 86400_000, 1);
  const left = Math.max((end.getTime() - now.getTime()) / 86400_000, 0);
  const projected = round2(c.total + (c.total / elapsed) * left);
  return {
    state: "live",
    mtd: c.total,
    projected,
    detail: [
      { name: `Compute (${(Number(p.compute_time_seconds ?? 0) / 3600).toFixed(1)} CU-hours)`, cost: c.compute },
      { name: "Storage", cost: c.storage },
      { name: "Data transfer over 500 GB", cost: c.transfer },
    ],
    note: `Estimate from Neon's usage counters since ${periodStart.toISOString().slice(0, 10)}; the invoice is exact.`,
  };
}

async function openai(now: Date): Promise<Live> {
  const need = missing(["OPENAI_ADMIN_KEY"]);
  if (need.length) return { state: "connect", missing: need };
  const { start } = monthWindow(now);
  const pages: Parameters<typeof sumOpenAiCosts>[0] = [];
  let page: string | null = null;
  for (let i = 0; i < 3; i++) {
    const qs = new URLSearchParams({ start_time: String(Math.floor(start.getTime() / 1000)), bucket_width: "1d", limit: "31" });
    if (page) qs.set("page", page);
    const j = (await getJson(`https://api.openai.com/v1/organization/costs?${qs}`, process.env.OPENAI_ADMIN_KEY!)) as {
      data?: { results?: { amount?: { value?: number } }[] }[];
      has_more?: boolean;
      next_page?: string | null;
    };
    pages.push(j);
    if (!j.has_more || !j.next_page) break;
    page = j.next_page;
  }
  const mtd = sumOpenAiCosts(pages);
  return { state: "live", mtd, projected: projectMonthEnd(mtd, now), detail: [] };
}

const FETCHERS: Partial<Record<ProviderId, (now: Date) => Promise<Live>>> = { vercel, neon, openai };

async function safe(fn: () => Promise<Live>): Promise<Live> {
  try {
    return await fn();
  } catch (e) {
    return { state: "error", message: e instanceof Error ? e.message.slice(0, 200) : "failed" };
  }
}

/** Real (non-seed) votes, voters and battles this month: the denominators for unit costs. Cached 15 min. */
const monthCounts = unstable_cache(
  async (startIso: string) => {
    const [r] = await db.execute<{ votes: number; voters: number; battles: number; signups: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM vote WHERE created_at >= ${startIso} AND COALESCE(source, '') <> 'seed' AND NOT flagged) AS votes,
        (SELECT count(DISTINCT COALESCE(user_id, device_id))::int FROM vote
          WHERE created_at >= ${startIso} AND COALESCE(source, '') <> 'seed' AND NOT flagged) AS voters,
        (SELECT count(*)::int FROM battle WHERE created_at >= ${startIso} AND id NOT LIKE 'seed_%') AS battles,
        (SELECT count(*)::int FROM analytics_event WHERE name = 'onboarding_completed' AND created_at >= ${startIso}) AS signups`);
    return r ?? { votes: 0, voters: 0, battles: 0, signups: 0 };
  },
  ["finance-month-counts"],
  { revalidate: CACHE_S },
);

export async function getFinance(now = new Date()) {
  const win = monthWindow(now);
  const [lives, counts] = await Promise.all([
    Promise.all(PLANS.map((p) => (FETCHERS[p.id] ? safe(() => FETCHERS[p.id]!(now)) : Promise.resolve<Live>({ state: "none" })))),
    monthCounts(win.start.toISOString()).catch(() => ({ votes: 0, voters: 0, battles: 0, signups: 0 })),
  ]);

  // Blob is billed inside Vercel's charges; don't count it twice. Show the Vercel line item on its row instead.
  const vercelLive = lives[PLANS.findIndex((p) => p.id === "vercel")];
  const rows: ProviderRow[] = PLANS.map((p, i) => {
    let live = lives[i];
    if (p.id === "blob") {
      const blobCost = vercelLive.state === "live" ? vercelLive.detail.filter((d) => /blob/i.test(d.name)) : [];
      live =
        vercelLive.state === "live"
          ? { state: "live", mtd: 0, projected: 0, detail: blobCost, note: "Included in the Vercel total above." }
          : vercelLive.state === "connect"
            ? vercelLive
            : { state: "none" };
    }
    // Neon bought through the Vercel Marketplace is invoiced by Vercel: keep its estimate as detail, don't add it twice.
    if (p.id === "neon" && live.state === "live" && vercelLive.state === "live") {
      const viaVercel = vercelLive.detail.filter((d) => /neon/i.test(d.name));
      if (viaVercel.length)
        live = { ...live, mtd: 0, projected: 0, note: `Billed through Vercel (in the Vercel total). ${live.note ?? ""}` };
    }
    const fixedMtd = round2(p.monthly * (win.elapsed / win.days));
    const mtd = live.state === "live" ? live.mtd : p.id === "vercel" ? p.monthly : fixedMtd;
    const projected = live.state === "live" ? live.projected : p.monthly;
    return { ...p, live, mtd: round2(mtd), projected: round2(projected) };
  });

  const total = {
    mtd: round2(rows.reduce((s, r) => s + r.mtd, 0)),
    projected: round2(rows.reduce((s, r) => s + r.projected, 0)),
    fixed: round2(PLANS.reduce((s, p) => s + p.monthly, 0)),
  };
  const connected = rows.filter((r) => r.liveVia.length && r.id !== "blob");
  const toConnect = [...new Set(rows.flatMap((r) => (r.live.state === "connect" ? r.live.missing : [])))];

  return {
    asOf: now.toISOString(),
    month: win.start.toISOString().slice(0, 7),
    dayOfMonth: Math.ceil(win.elapsed),
    daysInMonth: win.days,
    rows,
    total,
    counts,
    unit: {
      perVoter: perUnit(total.mtd, counts.voters),
      perThousandVotes: counts.votes ? (total.mtd / counts.votes) * 1000 : null,
      perSignup: perUnit(total.mtd, counts.signups),
    },
    liveCount: connected.filter((r) => r.live.state === "live").length,
    liveTotal: connected.length,
    toConnect,
  };
}
