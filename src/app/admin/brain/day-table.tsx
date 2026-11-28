/**
 * Day by day, as a table (Alex, Nov 28 2026: "the most important one", back at the top of the Brain after the cleanup
 * had moved it behind a button on the Trends tab). Rows come from `topNumbers().daily` (same `dailyNumbers()` counting).
 */
import Link from "next/link";
import type { BrainListKind } from "@/server/services/brain-lists";
import type { TopNumbers } from "@/server/services/brain-top";
import { Delta, Ratio, Rows, dayBreakEven, ratio } from "./ui";

export function DayTable({ daily, ue, listHref, days, trendsHref }: { daily: TopNumbers["daily"]; ue: TopNumbers["ue"]; listHref: (kind: BrainListKind, day?: string) => string; days: number; trendsHref: string }) {
  const rows = daily.slice(0, days === 1 ? 2 : days + 1);
  return (
    <section id="day-by-day" className="card scroll-mt-16 space-y-2 p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="mr-auto font-sans font-medium">Day by day</h2>
        <Link href={trendsHref} className="text-xs text-accent">
          Chart it ›
        </Link>
      </div>
      <Rows
        head={["Day", "Visitors (people)", "Visits", "Sign-ups", "Votes", "Voters (people)", "Votes per voter", "Votes per visitor", "Battles posted", "Break-even per visitor"]}
        rows={rows.map((d, i) => {
          const prev = rows[i + 1] ?? daily[i + 1];
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
      <p className="text-xs text-zinc-500">
        New York days, newest first; the top row is today so far. Tap any number to see who or what is behind it. The small number is the change from
        the day before. Visitors and Voters are people, so someone active on two days counts on both. Votes per voter = votes ÷ people who voted that day;
        votes per visitor = votes ÷ everyone who visited. Break-even per visitor = that day&apos;s visitors, visits, votes and sign-ups run through Unit
        economics (same prices and serving cost).
      </p>
    </section>
  );
}
