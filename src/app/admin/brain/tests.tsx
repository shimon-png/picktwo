/**
 * Every experiment on one card layout (Alex, Nov 28 2026): who's in it, the arms side by side on the one metric that
 * decides it, lift + p-value, and a badge from `testBadge()` (Too early / "<arm> ahead" / No difference / Off).
 * The top screen's "Live experiments" row and the Experiments tab read the same summaries.
 * To add a test (e.g. the Topics test): load its numbers in `loadTests()` and push a `TestSummary` in `summarize()`.
 */
import Link from "next/link";
import { gateTestResults } from "@/server/services/gate-test";
import { ARM_LABELS } from "@/server/services/gate-test-rules";
import { aboutStats } from "@/server/services/about-stats";
import { profileBarStats } from "@/server/services/profile-progress";
import { pickbotStats } from "@/server/services/pickbot-stats";
import { winbackStats } from "@/server/services/winback";
import { testBadge, type TestArm, type TestBadge } from "@/server/services/brain-top-rules";
import type { BrainView } from "@/server/services/brain";

export type TestSummary = {
  id: string;
  name: string;
  /** Who is in it, one line. */
  who: string;
  /** The metric that decides it. */
  metric: string;
  fmt: (v: number) => string;
  arms: TestArm[];
  lift: number | null;
  p: number | null;
  badge: TestBadge;
  /** Still collecting (shown in Live experiments on the top screen). */
  live: boolean;
};

export async function loadTests(view: BrainView, days: number) {
  const [gt, ab, pb, pk, wb] = await Promise.all([gateTestResults(days), aboutStats(view, days), profileBarStats(view, days), pickbotStats(view, days), winbackStats()]);
  return { gt, ab, pb, pk, wb, summaries: summarize({ gt, ab, pb, pk, wb }) };
}

type Loaded = {
  gt: Awaited<ReturnType<typeof gateTestResults>>;
  ab: Awaited<ReturnType<typeof aboutStats>>;
  pb: Awaited<ReturnType<typeof profileBarStats>>;
  pk: Awaited<ReturnType<typeof pickbotStats>>;
  wb: Awaited<ReturnType<typeof winbackStats>>;
};

const per = (a: { visitors: number; votes: number }) => (a.visitors ? a.votes / a.visitors : null);
const lift = (base: number | null, test: number | null) => (base == null || test == null || base === 0 ? null : (test - base) / base);
const pct1 = (v: number) => `${(100 * v).toFixed(1)}%`;
const two = (v: number) => v.toFixed(2);

function summarize({ gt, ab, pb, pk, wb }: Loaded): TestSummary[] {
  const out: TestSummary[] = [];
  // Topics test (50/50 on new browsers): built in its own PR; until its numbers are wired here it shows as not live.
  out.push({
    id: "topics",
    name: "Topics test",
    who: "50/50 on new browsers: topics in the Vote deck vs the mixed deck",
    metric: "came back on day 1 and day 3",
    fmt: pct1,
    arms: [],
    lift: null,
    p: null,
    badge: { label: "Not live yet", tone: "off" },
    live: false,
  });

  const gOn = gt.pct > 0 && !!gt.startedAt;
  const gArms: TestArm[] = [
    { label: ARM_LABELS.control, people: gt.total.control.visitors, value: gt.total.control.signupRate },
    { label: ARM_LABELS.soft, people: gt.total.soft.visitors, value: gt.total.soft.signupRate },
  ];
  out.push({
    id: "gate",
    name: "Sign-up gate test (A/B)",
    who: `New signed-out browsers, ${gt.pct}% to B`,
    metric: "sign-up rate",
    fmt: pct1,
    arms: gArms,
    lift: gt.signupLift,
    p: gt.signupP,
    badge: testBadge({ on: gOn, arms: gArms, p: gt.signupP }),
    live: gOn,
  });

  const aArms: TestArm[] = [
    { label: `No cards (${ab.holdoutPct}%)`, people: ab.arms.holdout.visitors, value: per(ab.arms.holdout) },
    { label: "Sees cards", people: ab.arms.cards.visitors, value: per(ab.arms.cards) },
  ];
  out.push({
    id: "about",
    name: "About-you cards holdout",
    who: `${ab.holdoutPct}% of people never see an about-you card`,
    metric: "votes per visitor",
    fmt: two,
    arms: aArms,
    lift: lift(aArms[0].value, aArms[1].value),
    p: ab.holdoutP,
    badge: testBadge({ on: ab.holdoutPct > 0, arms: aArms, p: ab.holdoutP }),
    live: ab.holdoutPct > 0,
  });

  const bArms: TestArm[] = [
    { label: `No bar (${pb.holdoutPct}%)`, people: pb.arms.holdout.visitors, value: per(pb.arms.holdout) },
    { label: "Sees the bar", people: pb.arms.bar.visitors, value: per(pb.arms.bar) },
  ];
  out.push({
    id: "profile-bar",
    name: "Profile bar",
    who: `${pb.holdoutPct}% of people never see the profile bar`,
    metric: "votes per visitor",
    fmt: two,
    arms: bArms,
    lift: lift(bArms[0].value, bArms[1].value),
    p: pb.p,
    badge: testBadge({ on: pb.holdoutPct > 0, arms: bArms, p: pb.p }),
    live: pb.holdoutPct > 0,
  });

  const kOn = pk.open && pk.holdoutPct > 0;
  const kArms: TestArm[] = [
    { label: `No Pickbot (${pk.holdoutPct}%)`, people: pk.arms.holdout.visitors, value: per(pk.arms.holdout) },
    { label: "Has Pickbot", people: pk.arms.pickbot.visitors, value: per(pk.arms.pickbot) },
  ];
  out.push({
    id: "pickbot",
    name: "Pickbot holdout",
    who: `Signed-in accounts; ${pk.holdoutPct}% never get Pickbot`,
    metric: "votes per visitor",
    fmt: two,
    arms: kArms,
    lift: lift(kArms[0].value, kArms[1].value),
    p: pk.holdoutP,
    badge: testBadge({ on: kOn, arms: kArms, p: pk.holdoutP }),
    live: kOn,
  });

  const fair = pk.promo.filter((r) => r.active >= 20);
  const best = [...fair].sort((x, y) => y.asked / y.active - x.asked / x.active)[0];
  out.push({
    id: "pickbot-promo",
    name: "“Ask Pickbot” card position",
    who: "Signed-in people who haven’t asked yet; a stable random spot per person",
    metric: "asked Pickbot per active person",
    fmt: pct1,
    arms: pk.promo.map((r) => ({ label: `After ${r.at} picks`, people: r.active, value: r.active ? r.asked / r.active : null })),
    lift: null,
    p: null,
    badge: !pk.promoOn ? { label: "Off", tone: "off" } : best && best.asked > 0 ? { label: `After ${best.at} picks leads`, tone: "flat" } : { label: "Too early", tone: "early" },
    live: pk.promoOn,
  });

  const email = wb.arms.find((r) => r.arm === "email");
  const hold = wb.arms.find((r) => r.arm !== "email");
  const wArms: TestArm[] = [
    { label: `No email (${wb.holdoutPct}%)`, people: hold?.people ?? 0, value: hold?.people ? hold.back3 / hold.people : null },
    { label: "Got the email", people: email?.people ?? 0, value: email?.people ? email.back3 / email.people : null },
  ];
  out.push({
    id: "winback",
    name: "Win-back emails",
    who: `People drifting away (${wb.lapsingNow} right now); ${wb.holdoutPct}% get no email`,
    metric: "voted within 3 days",
    fmt: pct1,
    arms: wArms,
    lift: lift(wArms[0].value, wArms[1].value),
    p: null,
    badge: wb.enabled ? { label: "Too early", tone: "early" } : { label: "Off", tone: "off" },
    live: wb.enabled,
  });
  return out;
}

/** Candy colours, the same in every theme (bright rule: never dark badges). */
const TONE: Record<TestBadge["tone"], React.CSSProperties> = {
  win: { background: "#8ef0b4", color: "#0d3b22" },
  early: { background: "#ffe27a", color: "#3d2e00" },
  flat: { background: "#9fdcff", color: "#0a3350" },
  off: { background: "#e9e4f5", color: "#4a4560" },
};

export function Badge({ b }: { b: TestBadge }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" style={TONE[b.tone]}>
      {b.label}
    </span>
  );
}

/** The standard experiment card. `children` = the full detail, behind "Show details". */
export function TestCard({ t, children }: { t: TestSummary; children?: React.ReactNode }) {
  const lead = Math.max(...t.arms.map((a) => a.value ?? 0), 0);
  return (
    <section id={`test-${t.id}`} className="card scroll-mt-16 space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-sans font-medium">{t.name}</h2>
        <Badge b={t.badge} />
      </div>
      <p className="text-xs text-zinc-500">
        {t.who}. Decided on <b>{t.metric}</b>.
        {t.lift != null && ` Test arm ${t.lift >= 0 ? "+" : "−"}${Math.abs(Math.round(t.lift * 100))}% vs control.`}
        {t.p != null && ` p = ${t.p < 0.001 ? "<0.001" : t.p.toFixed(3)}${t.p < 0.05 ? " (real difference)" : " (could be chance)"}.`}
        {" "}Too early = under 300 people in an arm or no p-value yet.
      </p>
      {t.arms.length > 0 && (
        <div className={`grid gap-2 ${t.arms.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
          {t.arms.map((a) => (
            <div key={a.label} className="rounded-xl bg-surface p-3">
              <div className="text-xs text-zinc-500">{a.label}</div>
              <div className="text-xl font-medium tabular-nums">{a.value == null ? "—" : t.fmt(a.value)}</div>
              <div className="mt-1 h-2 rounded-full bg-ink/5">
                <div className="h-2 rounded-full bg-a" style={{ width: `${lead && a.value ? Math.max(3, (100 * a.value) / lead) : 0}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">{a.people.toLocaleString()} people</div>
            </div>
          ))}
        </div>
      )}
      {children && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm text-accent">
            <span className="group-open:hidden">Show details ›</span>
            <span className="hidden group-open:inline">Hide details</span>
          </summary>
          <div className="space-y-2 pt-2">{children}</div>
        </details>
      )}
    </section>
  );
}

/** One row per running test on the top screen; each opens its card on the Experiments tab. */
export function LiveTests({ tests, href }: { tests: TestSummary[]; href: (id: string) => string }) {
  const shown = tests.filter((t) => t.live || t.id === "topics");
  return (
    <section className="card space-y-1 p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="mr-auto font-sans font-medium">Live experiments</h2>
        <Link href={href("")} className="text-xs text-accent">All tests ›</Link>
      </div>
      <ul className="divide-y divide-ink/10">
        {shown.map((t) => (
          <li key={t.id}>
            <Link href={href(t.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm hover:text-accent">
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-zinc-500">
                {t.arms.length === 2 && t.arms.every((a) => a.value != null)
                  ? `${t.metric}: ${t.fmt(t.arms[0].value!)} → ${t.fmt(t.arms[1].value!)}`
                  : t.metric}
              </span>
              <span className="ml-auto">
                <Badge b={t.badge} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
