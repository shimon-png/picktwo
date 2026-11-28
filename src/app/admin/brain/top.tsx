/**
 * The Brain's top screen (Alex, Nov 28 2026): six headline numbers with a 14-day sparkline and the change against the
 * 7 days before, then the funnel strip. Everything opens the list or Journey step behind it.
 */
import Link from "next/link";
import type { Kpi, FunnelStep } from "@/server/services/brain-top-rules";
import type { TopNumbers } from "@/server/services/brain-top";
import { money } from "@/server/services/unit-economics-rules";
import { Sparkline } from "./charts-client";

type Tile = { key: string; label: string; kpi: Kpi; fmt: (v: number) => string; higherIsBetter: boolean; sub: string; href: string; bench?: number };

const pct0 = (v: number) => `${Math.round(v * 100)}%`;
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const short = (day: string | null) => (day ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");

function Change({ k, higherIsBetter, pace }: { k: Kpi; higherIsBetter: boolean; pace?: boolean }) {
  if (k.change == null) return <span className="text-zinc-500">no 7-day average yet</span>;
  const up = k.change >= 0;
  const good = up === higherIsBetter;
  const size = Math.abs(Math.round(k.change * 100));
  return (
    <span className={size === 0 ? "text-zinc-500" : good ? "text-green" : "text-b"}>
      {size === 0 ? "level with" : `${up ? "▲" : "▼"} ${size}% ${pace ? "pace vs" : "vs"}`} 7-day avg
    </span>
  );
}

export function KpiTiles({ top, listHref, journeyHref, growthHref }: { top: TopNumbers; listHref: (kind: "visitors" | "votes" | "signups", day?: string) => string; journeyHref: (step: string) => string; growthHref: string }) {
  const tiles: Tile[] = [
    { key: "visitors", label: "Visitors today", kpi: top.visitors, fmt: (v) => Math.round(v).toLocaleString(), higherIsBetter: true, sub: "people, so far today", href: listHref("visitors", top.today) },
    { key: "bounce", label: "Bounce rate today", kpi: top.bounce, fmt: pct0, higherIsBetter: false, sub: "dashed line = 80% benchmark", href: journeyHref("bounced"), bench: 0.8 },
    { key: "vpv", label: "Votes per visitor today", kpi: top.votesPerVisitor, fmt: (v) => v.toFixed(2), higherIsBetter: true, sub: "votes ÷ everyone who visited", href: listHref("votes", top.today) },
    { key: "signup", label: "Sign-up rate today", kpi: top.signupRate, fmt: pct1, higherIsBetter: true, sub: `${top.signupsToday} sign-up${top.signupsToday === 1 ? "" : "s"} so far`, href: listHref("signups", top.today) },
    {
      key: "return",
      label: `Came back next day`,
      kpi: top.returnD1,
      fmt: pct0,
      higherIsBetter: true,
      sub: top.returnD1.day ? `new visitors on ${short(top.returnD1.day)} (newest finished day)` : "new visitors back the day after",
      href: journeyHref("returned"),
    },
    { key: "be", label: "Break-even per visitor today", kpi: top.breakEven, fmt: money, higherIsBetter: true, sub: "most we can pay for a visitor", href: growthHref },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3" aria-label="Headline numbers">
      {tiles.map((t) => (
        <Link key={t.key} href={t.href} className="card block space-y-1 p-4 transition hover:ring-1 hover:ring-accent">
          <div className="text-xs text-zinc-500">{t.label} ›</div>
          <div className="font-display text-[34px] font-semibold leading-none tabular-nums">{t.kpi.now == null ? "—" : t.fmt(t.kpi.now)}</div>
          <div className="text-[11px] leading-tight">
            <Change k={t.kpi} higherIsBetter={t.higherIsBetter} pace={t.key === "visitors"} />
            {t.kpi.avg != null && <span className="text-zinc-500"> ({t.fmt(t.kpi.avg)})</span>}
          </div>
          <Sparkline values={t.kpi.series} days={t.kpi.seriesDays} labels={t.kpi.series.map((v) => (v == null ? null : t.fmt(v)))} bench={t.bench} label={`${t.label}, last 14 days`} />
          <div className="text-[11px] text-zinc-500">{t.sub}</div>
        </Link>
      ))}
    </div>
  );
}

/** Where Journey or the lists hold the people behind each step. */
const STEP_HREF: Record<FunnelStep["key"], string> = { visitors: "all", engaged: "engaged", voted: "voted", voted3: "votes:3-99999", gate: "", signed: "signed", back: "returned" };

export function FunnelStrip({ steps, days, journeyHref, gateHref }: { steps: FunnelStep[]; days: number; journeyHref: (step: string) => string; gateHref: string }) {
  const first = steps[0]?.n || 1;
  return (
    <section className="card space-y-2 p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="mr-auto font-sans font-medium">Funnel · {days === 1 ? "last 24h" : `last ${days} days`}</h2>
        <span className="text-xs text-zinc-500">Bar = share of visitors; small number = share of the step before. Tap a step for its people.</span>
      </div>
      <ol className="grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {steps.map((s) => (
          <li key={s.key} className="min-w-0">
            <Link
              href={s.key === "gate" ? gateHref : journeyHref(STEP_HREF[s.key])}
              className="flex h-full flex-col rounded-xl bg-a-soft p-2.5 transition hover:ring-1 hover:ring-accent"
            >
              <div className="truncate text-xs text-zinc-500">{s.label}</div>
              <div className="text-xl font-medium tabular-nums">{s.n.toLocaleString()}</div>
              <div className="mt-1 h-1.5 rounded-full bg-white/70">
                <div className="h-1.5 rounded-full bg-a" style={{ width: `${Math.max(2, (100 * s.n) / first)}%` }} />
              </div>
              <div className="mt-1 truncate text-[11px] text-zinc-500">{s.ofVisitors == null ? "—" : `${Math.round(100 * s.ofVisitors)}% of visitors`}</div>
              <div className="truncate text-[11px] text-zinc-500">{s.fromPrev == null ? "\u00a0" : `${Math.round(100 * s.fromPrev)}% of step before`}</div>
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-zinc-500">
        Steps aren’t strictly nested: some people sign up without hitting the wall, and Came back = visited on 2+ New York days in the window.
      </p>
    </section>
  );
}
