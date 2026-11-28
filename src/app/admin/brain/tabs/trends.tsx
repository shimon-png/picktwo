import Link from "next/link";
import { beforeAfterStats, brainScope, dailyNumbers } from "@/server/services/brain";
import { change } from "@/server/services/before-after-rules";
import { ueBasics } from "@/server/services/unit-economics";
import { money, unitEconomics } from "@/server/services/unit-economics-rules";
import type { BrainListKind } from "@/server/services/brain-lists";
import { TrendChart } from "../charts";
import { Delta, Ratio, Rows, Section, ShowMore, dayBreakEven, makeListHref, pct, ratio, spanLabel, type TabProps } from "../ui";

/** Day by day as one chart at a time (pick the number), the full table behind "Show table"; Before vs after. */
const METRICS: { key: string; label: string; kind: BrainListKind; fmt: (v: number) => string; value: (d: Day, be: (d: Day) => number | null) => number | null }[] = [
  { key: "visitors", label: "Visitors", kind: "visitors", fmt: (v) => Math.round(v).toLocaleString(), value: (d) => d.visitors },
  { key: "votes", label: "Votes", kind: "votes", fmt: (v) => Math.round(v).toLocaleString(), value: (d) => d.votes },
  { key: "vpv", label: "Votes per visitor", kind: "votes", fmt: (v) => v.toFixed(1), value: (d) => (d.visitors ? d.votes / d.visitors : null) },
  { key: "voted", label: "% who voted", kind: "voters", fmt: (v) => `${Math.round(v * 100)}%`, value: (d) => (d.visitors ? d.voters / d.visitors : null) },
  { key: "signups", label: "Sign-ups", kind: "signups", fmt: (v) => Math.round(v).toLocaleString(), value: (d) => d.signups },
  { key: "signupRate", label: "Sign-up rate", kind: "signups", fmt: (v) => `${(v * 100).toFixed(1)}%`, value: (d) => (d.visitors ? d.signups / d.visitors : null) },
  { key: "posts", label: "Battles posted", kind: "battles", fmt: (v) => Math.round(v).toLocaleString(), value: (d) => d.posts },
  { key: "be", label: "Break-even per visitor", kind: "visitors", fmt: money, value: (d, be) => be(d) },
];
type Day = { day: string; visitors: number; visits: number; signups: number; votes: number; voters: number; posts: number };

export async function TrendsTab({ days, view, metric }: TabProps & { metric?: string }) {
  const listHref = makeListHref(days, view);
  const scope = await brainScope(view, Math.max(days, 14));
  const [rawDaily, ba, ue] = await Promise.all([dailyNumbers(scope), beforeAfterStats(view), ueBasics()]);
  const daily: Day[] = rawDaily.map((d) => ({ day: d.day, visitors: Number(d.visitors), visits: Number(d.visits), signups: Number(d.signups), votes: Number(d.votes), voters: Number(d.voters), posts: Number(d.posts) }));
  const s = { daily: daily.slice(0, days === 1 ? 2 : days + 1) };
  const m = METRICS.find((x) => x.key === metric) ?? METRICS[2];
  const be = (d: Day) => (d.visitors ? unitEconomics({ ...d, costPerVisitor: ue.costPerVisitor }, ue.assumptions).breakEven : null);
  const points = [...daily].reverse().map((d) => ({ day: d.day, value: m.value(d, be), href: listHref(m.kind, d.day) }));
  const old = Date.parse(`${ba.changeDay}T12:00:00Z`) < Date.now() - 14 * 86400_000;
  const q = (k: string) => `/admin/brain?tab=trends&days=${days}${view === "all" ? "&view=all" : ""}&metric=${k}`;
  return (
    <>
      <Section
        title={`Day by day · ${m.label}`}
        note="New York days, last 14 at least (whatever window is picked). The dashed line is the 7-day average, so one odd day doesn't hide the trend. Tap a dot for that day's list."
      >
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((x) => (
            <Link key={x.key} href={q(x.key)} scroll={false} className={`chip !py-1 text-xs ${x.key === m.key ? "chip-on" : ""}`}>
              {x.label}
            </Link>
          ))}
        </div>
        <TrendChart points={points} fmt={m.fmt} label={`${m.label} by day`} />
        <ShowMore label="Show table">
          <p className="text-xs text-zinc-500">
            Tap any number to see who or what is behind it. The small number is the change from the day before. Visitors and Voters are people, so someone
            active on two days counts on both. Votes per voter = votes ÷ people who voted that day; votes per visitor = votes ÷ everyone who visited.
            Break-even per visitor = that day&apos;s visitors, visits, votes and sign-ups run through Unit economics (same prices and serving cost).
          </p>
        <Rows
          head={["Day", "Visitors (people)", "Visits", "Sign-ups", "Votes", "Voters (people)", "Votes per voter", "Votes per visitor", "Battles posted", "Break-even per visitor"]}
          rows={s.daily.map((d, i) => {
            const prev = s.daily[i + 1];
            const cell = (kind: BrainListKind, now: number, before: number | undefined) =>
              now > 0 ? (
                <Link key={kind + now} href={listHref(kind, d.day)} className="underline decoration-ink/20 underline-offset-2 hover:decoration-accent">
                  <Delta now={now} prev={before} />
                </Link>
              ) : (
                <Delta key={kind} now={now} prev={before} />
              );
            return [
              d.day,
              cell("visitors", d.visitors, prev?.visitors),
              cell("visitors", d.visits, prev?.visits),
              cell("signups", d.signups, prev?.signups),
              cell("votes", d.votes, prev?.votes),
              cell("voters", d.voters, prev?.voters),
              <Ratio key="vpv" now={ratio(d.votes, d.voters)} prev={prev && ratio(prev.votes, prev.voters)} />,
              <Ratio key="vpvis" now={ratio(d.votes, d.visitors)} prev={prev && ratio(prev.votes, prev.visitors)} />,
              cell("battles", d.posts, prev?.posts),
              dayBreakEven(ue, d),
            ];
          })}
        />
        </ShowMore>
      </Section>

      <Section
        collapsed={old}
        title={`Before vs after the change · ${ba.changeDay}${ba.changeTime ? ` ${ba.changeTime}` : ""}`}
        note={`The about-you launch (cards in the deck, "people like you", one-tap sign-up, taste profile) went live on ${ba.changeDay}${ba.changeTime ? ` at ${ba.changeTime} New York time. That day is split in two rows: until ${ba.changeTime} counts as Before, from ${ba.changeTime} as After` : "; that day counts as neither side"}. Same counting as Day by day (${view === "clean" ? "Clean" : "All data"} view). Averages are per day; partial days (the split day's halves and today so far) count as that fraction of a day. While a side covers only a few hours its per-day numbers are scaled up from very little data, so they swing a lot; the ratios (votes per visitor, sign-up rate) settle sooner. To compare around a different change, set beforeAfterFrom in Config (YYYYMMDDHHmm New York time, or YYYYMMDD).`}
      >
        <Rows
          head={["Per day", `Before (${spanLabel(ba.before.span)})`, `After (${spanLabel(ba.after.span)})`, "Change"]}
          rows={(
            [
              ["Visitors", ba.before.visitors, ba.after.visitors, (x: number) => x.toFixed(1)],
              ["Votes", ba.before.votes, ba.after.votes, (x: number) => x.toFixed(1)],
              ["Voters", ba.before.voters, ba.after.voters, (x: number) => x.toFixed(1)],
              ["Sign-ups", ba.before.signups, ba.after.signups, (x: number) => x.toFixed(1)],
              ["Votes per visitor", ba.before.votesPerVisitor, ba.after.votesPerVisitor, (x: number) => x.toFixed(2)],
              ["Votes per voter", ba.before.votesPerVoter, ba.after.votesPerVoter, (x: number) => x.toFixed(2)],
              ["Sign-up rate (of visitors)", ba.before.signupRate, ba.after.signupRate, (x: number) => `${(100 * x).toFixed(1)}%`],
            ] as const
          ).map(([label, b, a, fmt]) => {
            const c = ba.after.span > 0 && ba.before.span > 0 ? change(b, a) : null;
            return [
              label,
              ba.before.span > 0 ? fmt(b) : "—",
              ba.after.span > 0 ? fmt(a) : "—",
              c == null ? "—" : <span key="c" className={c > 0 ? "text-green" : c < 0 ? "text-b" : ""}>{`${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(Math.round(c * 100))}%`}</span>,
            ];
          })}
        />
        <Rows
          head={["Day", "Period", "Visitors", "Votes", "Voters", "Votes per visitor", "Votes per voter", "Sign-ups", "Sign-up rate"]}
          rows={ba.rows.map((d) => [
            d.label,
            d.period === "launch" ? <b key="p">Launch day</b> : d.period === "after" ? <span key="p" className="text-green">After</span> : "Before",
            d.visitors,
            d.votes,
            d.voters,
            d.visitors ? (d.votes / d.visitors).toFixed(1) : "—",
            d.voters ? (d.votes / d.voters).toFixed(1) : "—",
            d.signups,
            pct(d.signups, d.visitors),
          ])}
        />
        {ba.after.span === 0 && <p className="text-xs text-zinc-500">Nothing after the change yet.</p>}
      </Section>
    </>
  );
}
