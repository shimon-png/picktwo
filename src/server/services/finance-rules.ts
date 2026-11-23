/**
 * Pure money math for /admin/finance (no I/O, unit-tested). Plan prices are list prices as of Nov 2026;
 * update them here when a plan changes. docs/architecture.md explains each service.
 */

export type PlanPrice = {
  id: ProviderId;
  name: string;
  /** What the service does for us, in plain words. */
  role: string;
  plan: string;
  /** Fixed monthly fee in USD (yearly fees divided by 12). */
  monthly: number;
  /** Env vars that turn on the live spend pull. Empty = no billing API, list price only. */
  liveVia: string[];
  /** Where to see the real bill. */
  billingUrl: string;
  note?: string;
};

export type ProviderId =
  | "vercel"
  | "neon"
  | "openai"
  | "resend"
  | "blob"
  | "upstash"
  | "domain"
  | "photodna"
  | "pexels"
  | "google";

export const PLANS: PlanPrice[] = [
  {
    id: "vercel",
    name: "Vercel",
    role: "Hosts the website and API, runs the daily cron, builds every change",
    plan: "Pro (1 seat)",
    monthly: 20,
    liveVia: ["VERCEL_TOKEN", "VERCEL_TEAM_ID"],
    billingUrl: "https://vercel.com/dashboard/usage",
    note: "Pro includes $20 of usage credit; usage past it is billed on top.",
  },
  {
    id: "neon",
    name: "Neon",
    role: "The Postgres database: users, battles, votes, events",
    plan: "Launch (usage-based)",
    monthly: 0,
    liveVia: ["NEON_API_KEY", "NEON_PROJECT_ID"],
    billingUrl: "https://console.neon.tech/app/billing",
    note: "No monthly minimum: $0.106 per compute-hour + $0.35 per GB-month of storage.",
  },
  {
    id: "blob",
    name: "Vercel Blob",
    role: "Stores uploaded photos and avatars",
    plan: "Billed inside Vercel",
    monthly: 0,
    liveVia: ["VERCEL_TOKEN", "VERCEL_TEAM_ID"],
    billingUrl: "https://vercel.com/dashboard/stores",
    note: "Shows up as a Vercel line item.",
  },
  {
    id: "openai",
    name: "OpenAI",
    role: "Screens uploaded photos for nudity/violence (free endpoint); future battle tagging",
    plan: "Pay as you go",
    monthly: 0,
    liveVia: ["OPENAI_ADMIN_KEY"],
    billingUrl: "https://platform.openai.com/usage",
    note: "Moderation is free; this only moves once paid models are used.",
  },
  {
    id: "resend",
    name: "Resend",
    role: "Sends sign-in codes and alert emails",
    plan: "Free (3,000/mo, 100/day)",
    monthly: 0,
    liveVia: [],
    billingUrl: "https://resend.com/settings/billing",
    note: "Pro is $20/mo for 50,000 emails once we pass 100 a day.",
  },
  {
    id: "upstash",
    name: "Upstash Redis",
    role: "Shared rate limits across servers (optional)",
    plan: "Free tier",
    monthly: 0,
    liveVia: [],
    billingUrl: "https://console.upstash.com/account/billing",
  },
  {
    id: "domain",
    name: "crowdpick.ai domain",
    role: "The web address",
    plan: ".ai, $200 per 2-year term",
    monthly: 200 / 24,
    liveVia: [],
    billingUrl: "",
    note: "Paid $200 (Alex, Nov 2026); .ai is registered in 2-year terms, so ~$8.33/mo.",
  },
  {
    id: "photodna",
    name: "Microsoft PhotoDNA",
    role: "Known child-abuse image matching (legal duty)",
    plan: "Free for vetted organisations",
    monthly: 0,
    liveVia: [],
    billingUrl: "",
  },
  {
    id: "pexels",
    name: "Pexels",
    role: "Free stock photos for seed battles",
    plan: "Free",
    monthly: 0,
    liveVia: [],
    billingUrl: "",
  },
  {
    id: "google",
    name: "Google sign-in",
    role: "Optional \"Sign in with Google\"",
    plan: "Free",
    monthly: 0,
    liveVia: [],
    billingUrl: "",
  },
];

/** Neon Launch list prices (Nov 2026). */
export const NEON_RATES = { computeHour: 0.106, storageGbMonth: 0.35, transferFreeGb: 500, transferGb: 0.1 };

/** Start of the UTC calendar month, start of next month, days in month and days elapsed (fractional). */
export function monthWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const days = (end.getTime() - start.getTime()) / 86400_000;
  const elapsed = Math.max((now.getTime() - start.getTime()) / 86400_000, 1 / 24);
  return { start, end, days, elapsed: Math.min(elapsed, days) };
}

/** Straight-line projection of month-to-date usage to month end. Fixed fees are added whole, not projected. */
export function projectMonthEnd(usageMtd: number, now: Date, fixed = 0) {
  const { days, elapsed } = monthWindow(now);
  // Early in the month a single day's spike dominates; don't project from under a day of data.
  const factor = elapsed < 1 ? 1 : days / elapsed;
  return round2(fixed + usageMtd * factor);
}

/** Neon monitoring numbers (GET /projects/:id) → dollars. Approximate; Neon's invoice is the source of truth. */
export function neonCost(p: { computeSeconds: number; storageByteHours: number; transferBytes: number }) {
  const compute = (p.computeSeconds / 3600) * NEON_RATES.computeHour;
  const storage = (p.storageByteHours / 744 / 1e9) * NEON_RATES.storageGbMonth;
  const transfer = Math.max(0, p.transferBytes / 1e9 - NEON_RATES.transferFreeGb) * NEON_RATES.transferGb;
  return { compute: round2(compute), storage: round2(storage), transfer: round2(transfer), total: round2(compute + storage + transfer) };
}

/** Vercel FOCUS rows (JSONL) → total and per-service usage. Cost values can arrive as strings. */
export function sumFocusRows(jsonl: string) {
  const byService = new Map<string, number>();
  let usage = 0;
  let other = 0;
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const cost = Number(row.BilledCost ?? 0);
    if (!Number.isFinite(cost) || cost === 0) continue;
    const provider = row.ServiceProviderName ? String(row.ServiceProviderName) : "";
    const service = String(row.ServiceName ?? "Other");
    // Marketplace add-ons (e.g. Neon bought through Vercel) carry their own provider name.
    const name = provider && !/vercel/i.test(provider) && !service.toLowerCase().includes(provider.toLowerCase()) ? `${provider} · ${service}` : service;
    byService.set(name, (byService.get(name) ?? 0) + cost);
    if (row.ChargeCategory === "Usage" || row.ChargeCategory == null) usage += cost;
    else other += cost;
  }
  const services = [...byService.entries()].map(([name, cost]) => ({ name, cost: round2(cost) })).sort((a, b) => b.cost - a.cost);
  return { usage: round2(usage), other: round2(other), services };
}

/** OpenAI /v1/organization/costs pages → dollars. */
export function sumOpenAiCosts(pages: { data?: { results?: { amount?: { value?: number | string } }[] }[] }[]) {
  let total = 0;
  for (const p of pages) for (const b of p.data ?? []) for (const r of b.results ?? []) total += Number(r.amount?.value ?? 0) || 0;
  return round2(total);
}

export const perUnit = (cost: number, n: number) => (n > 0 ? cost / n : null);
export const round2 = (n: number) => Math.round(n * 100) / 100;
