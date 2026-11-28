/**
 * Every experiment on one card layout (Alex, Nov 28 2026): who's in it, the arms side by side on the one metric that
 * decides it, lift + p-value, and a badge from `testBadge()` (Too early / "<arm> ahead" / No difference / Off).
 * The top screen's "Live experiments" row and the Experiments tab read the same summaries.
 * To add a test: load its numbers in `loadTests()` and push a `TestSummary` in `summarize()`, with an `about` paragraph
 * in plain English (Alex, Nov 28: "we might forget what we're testing").
 */
import Link from "next/link";
import { gateTestResults } from "@/server/services/gate-test";
import { ARM_LABELS } from "@/server/services/gate-test-rules";
import { aboutStats } from "@/server/services/about-stats";
import { profileBarStats } from "@/server/services/profile-progress";
import { pickbotStats } from "@/server/services/pickbot-stats";
import { winbackStats } from "@/server/services/winback";
import { topicsTestResults } from "@/server/services/topics-test";
import { TOPICS_ARM_LABELS } from "@/server/services/topics-test-rules";
import { testBadge, type TestArm, type TestBadge } from "@/server/services/brain-top-rules";
import type { BrainView } from "@/server/services/brain";

export type TestSummary = {
  id: string;
  name: string;
  /** What we're testing and why, in plain English (shown at the top of the card). */
  about: string;
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
  const [gt, ab, pb, pk, wb, tp] = await Promise.all([
    gateTestResults(days),
    aboutStats(view, days),
    profileBarStats(view, days),
    pickbotStats(view, days),
    winbackStats(),
    topicsTestResults(),
  ]);
  return { gt, ab, pb, pk, wb, tp, summaries: summarize({ gt, ab, pb, pk, wb, tp }) };
}

type Loaded = {
  gt: Awaited<ReturnType<typeof gateTestResults>>;
  ab: Awaited<ReturnType<typeof aboutStats>>;
  pb: Awaited<ReturnType<typeof profileBarStats>>;
  pk: Awaited<ReturnType<typeof pickbotStats>>;
  wb: Awaited<ReturnType<typeof winbackStats>>;
  tp: Awaited<ReturnType<typeof topicsTestResults>>;
};

const per = (a: { visitors: number; votes: number }) => (a.visitors ? a.votes / a.visitors : null);
const lift = (base: number | null, test: number | null) => (base == null || test == null || base === 0 ? null : (test - base) / base);
const pct1 = (v: number) => `${(100 * v).toFixed(1)}%`;
const two = (v: number) => v.toFixed(2);

function summarize({ gt, ab, pb, pk, wb, tp }: Loaded): TestSummary[] {
  const out: TestSummary[] = [];
  const tOn = tp.pct > 0 && !!tp.startedAt;
  const tArms: TestArm[] = [
    { label: TOPICS_ARM_LABELS.control, people: tp.total.control.visitors, value: tp.total.control.signupRate },
    { label: TOPICS_ARM_LABELS.topics, people: tp.total.topics.visitors, value: tp.total.topics.signupRate },
  ];
  out.push({
    id: "topics",
    name: "Topics test",
    about:
      "Does letting people pick a topic in the Vote deck keep them around longer? Half of brand-new visitors get the old deck, where every battle is mixed together. The other half get a row of topic chips above the deck (Mix, Couples, Money & jobs, Family, Weddings, Friends, Everyday life, Babies, Investing, Current events), a card after 6 picks asking if they want to get more specific, and a sign-up wall named after their topic (\u201cYou\u2019ve judged 10 Couples battles\u201d). Our bet: choosing a topic holds interest, so people vote more and sign up more. We\u2019re less sure it brings them back the next day. Plan: read it after 4\u20135 days of data.",
    who: `New browsers since ${tp.startedAt ?? "launch"} (no votes, no account), ${tp.pct}% to Topics; the whole test, not the picked window`,
    metric: "sign-up rate",
    fmt: pct1,
    arms: tArms,
    lift: tp.signupLift,
    p: tp.signupP,
    badge: testBadge({ on: tOn, arms: tArms, p: tp.signupP }),
    live: tOn,
  });

  const gOn = gt.pct > 0 && !!gt.startedAt;
  const gArms: TestArm[] = [
    { label: ARM_LABELS.control, people: gt.total.control.visitors, value: gt.total.control.signupRate },
    { label: ARM_LABELS.soft, people: gt.total.soft.visitors, value: gt.total.soft.signupRate },
  ];
  out.push({
    id: "gate",
    name: "Sign-up gate test (A/B)",
    about:
      "When a signed-out visitor uses up their free votes, should we block them until they sign up, or just ask? Group A (control) hits a hard wall: no more votes without an account. Group B gets a sign-up box they can close (\u201cNot now, keep voting\u201d) that comes back every few votes. We\u2019re checking whether the softer ask loses sign-ups, or wins them by letting people get more hooked first.",
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
    about:
      "The deck mixes in quick about-you questions (sex, age, relationship, kids and so on) between battles. They power \u201cpeople like you\u201d results and the personality map, but they could also annoy people into leaving. A small group never sees them, so we can tell whether the cards cost us votes.",
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
    about:
      "A slim progress bar at the top of the deck counts toward a complete profile (four about-you answers and 30 battles). The idea is that a visible goal keeps people voting. A small group never sees the bar so we can measure whether it really adds votes.",
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
    about:
      "Pickbot is the AI that answers your own questions in the Ask tab. We hold back a small share of signed-in people who never get it, to see whether having Pickbot makes people vote more on the crowd\u2019s battles (or less, because they\u2019re busy chatting).",
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
    about:
      "A one-time card in the deck invites signed-in people to ask Pickbot a question. Each person gets it at a random spot (after 4, 5, 6, 8, 10, 12, 15 or 20 picks). Too early and it interrupts, too late and people have left, so we\u2019re looking for the spot where the most people go on to ask.",
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
    about:
      "When a signed-in person who usually comes back goes quiet for twice their normal gap, we email them three battles picked for them. Some drifting people get no email so we can see whether the email actually brings people back to vote. This stays off until win-back emails are switched on in Config.",
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
      <p className="rounded-xl bg-a-soft p-3 text-sm leading-relaxed">
        <span className="font-medium">What we&apos;re testing: </span>
        {t.about}
      </p>
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
