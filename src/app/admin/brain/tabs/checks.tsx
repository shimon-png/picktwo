import { getBrainStats } from "@/server/services/brain";
import { signupSources } from "@/server/services/acquisition";
import { skipStats } from "@/server/services/skip-stats";
import { brainChecks } from "@/server/services/brain-checks";
import Link from "next/link";
import { Num, PLACE_KEY, Rows, Section, battleLink, makeListHref, pct, secs, type TabProps } from "../ui";
import { loadThemes } from "./deck";

/** Do the numbers add up, plus the raw tables behind them (Alex, Nov 28: kept, just out of the way). */
export async function ChecksTab({ days, view }: TabProps) {
  const listHref = makeListHref(days, view);
  const [s, acq, sk, te] = await Promise.all([getBrainStats(days, view), signupSources(Math.max(days, 30), view), skipStats(view, days), loadThemes(days, view)]);
  const t = s.tiles;
  const n = (k: string) => Number(t[k] ?? 0);
  const viewedTotal = s.byKind.reduce((a, k) => a + k.seen, 0);
  const viewedVoted = s.byKind.reduce((a, k) => a + k.voted, 0);
  const placeKind = (pl: string, k: string) => s.votePlaces.filter((r) => r.place === pl && r.kind === k).reduce((a, r) => a + r.n, 0);
  const votesByKind = (k: string) => s.votePlaces.filter((r) => r.kind === k).reduce((a, r) => a + r.n, 0);
  const placeTotal = s.votePlaces.reduce((a, r) => a + r.n, 0);
  const places = [...new Set(s.votePlaces.map((r) => r.place))];
  const checks = brainChecks({
    visits: n("sessions"),
    visitors: n("visitors"),
    votes: n("real_votes"),
    voters: n("voters"),
    signups: n("signups"),
    battles: n("real_battles"),
    daily: s.daily,
    visitSources: s.visitSources,
    byKind: s.byKind,
    votePlaces: s.votePlaces,
    rawSources: s.sources,
    signupSourcesTotal: acq.days === days ? acq.total.signups : undefined,
    skips: n("skips"),
    themes: te.error ? undefined : te.themes,
  });
  const failed = checks.filter((c) => !c.ok);
  // The totals the checks compare against (the old 15-tile grid), each still opening its list.
  const tiles: [string, string | number, string][] = [
    ["Visits", n("sessions"), listHref("visitors")],
    ["Visitors (people)", n("visitors"), listHref("visitors")],
    ["Deck cards shown", n("views"), listHref("cards")],
    ["Cards seen → voted", pct(viewedVoted, viewedTotal), listHref("cards", undefined, { outcome: "voted" })],
    [view === "clean" ? "Votes by real people" : "Votes (incl. seed)", n("real_votes"), listHref("votes")],
    ["People who voted", n("voters"), listHref("voters")],
    ["Median time to pick", secs(t.median_pick_ms), listHref("votes", undefined, { place: "feed" })],
    ["Skips", n("skips"), listHref("skips")],
    ["Deck skip rate", pct(sk.total.skipped, sk.total.voted + sk.total.skipped), listHref("cards", undefined, { outcome: "skipped" })],
    ["People who hit the sign-up wall", n("gates"), listHref("gates")],
    ["Sign-ups", n("signups"), listHref("signups")],
    ["Vote changes", n("changed"), listHref("changes")],
    [view === "clean" ? "Battles posted by real people" : "Battles posted", n("real_battles"), listHref("battles")],
    ["Seed votes (all time, excluded)", n("seed_votes_all"), listHref("seedvotes")],
  ];
  return (
    <>
      <section className={`card space-y-2 p-4 ${failed.length ? "ring-1 ring-b" : ""}`}>
        <h2 className="font-sans font-medium">
          {failed.length === 0 ? (
            <>
              <span className="text-green">✓</span> All {checks.length} number checks pass
            </>
          ) : (
            <span className="text-b">
              {failed.length} number check{failed.length > 1 ? "s" : ""} failed. Tell Claude; something is counting wrong.
            </span>
          )}
        </h2>
        <ul className="space-y-0.5 text-xs">
          {checks.map((c, i) => (
            <li key={i} className={c.ok ? "text-zinc-500" : "text-b"}>
              {c.ok ? "✓" : "✗"} {c.rule}
              {!c.ok && `: ${c.detail}`}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v, to]) => (
          <Link key={k} href={to} className="card block p-3 transition hover:ring-1 hover:ring-accent">
            <div className="text-xs text-zinc-500">{k} ›</div>
            <div className="text-2xl font-medium">{v}</div>
          </Link>
        ))}
      </div>

      <Section title="Where votes were made" note={`Every counted vote, by the screen it was made on. The total matches the "Votes by real people" tile.`}>
        <Rows
          head={["Place", "Text", "Photo", "Total"]}
          rows={[
            ...places.map((pl) => {
              const t = placeKind(pl, "text"), ph = placeKind(pl, "photo");
              const place = PLACE_KEY[pl] ? { place: PLACE_KEY[pl] } : undefined;
              return [
                pl,
                <Num key="t" n={t} href={listHref("votes", undefined, { ...place, kind: "text" })} />,
                <Num key="p" n={ph} href={listHref("votes", undefined, { ...place, kind: "photo" })} />,
                <Num key="a" n={t + ph} href={listHref("votes", undefined, place)} />,
              ];
            }),
            [
              "Total",
              <Num key="t" n={votesByKind("text")} href={listHref("votes", undefined, { kind: "text" })} />,
              <Num key="p" n={votesByKind("photo")} href={listHref("votes", undefined, { kind: "photo" })} />,
              <Num key="a" n={placeTotal} href={listHref("votes")} />,
            ],
          ]}
        />
      </Section>

      <Section title="Raw source tags" note="utm_source, else the referring site, else direct. These are people, not votes: Visitors who came that way, and how many of them voted at least once.">
        <Rows head={["Source", "Visits", "Visitors (people)", "People who voted", "Voter rate"]} rows={s.sources.map((r) => [r.source, r.sessions, r.visitors, r.voters, pct(r.voters, r.visitors)])} />
      </Section>

      <Section title="Next-day return" note="People first seen in this window on that day (New York time) who visited again the next day. The last day can't have returns yet.">
        <Rows head={["First seen", "New visitors", "Back next day", "Rate"]} rows={s.retention.map((r) => [r.day, r.new_visitors, r.back_d1, pct(r.back_d1, r.new_visitors)])} />
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="How people pick" note="Every vote, by how it was made (tap, swipe, key), from the vote log.">
          <Rows head={["Method", "Votes"]} rows={s.methods.map((m) => [m.method, m.n])} />
        </Section>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Closest to 50/50" note={view === "clean" ? "10+ real votes since the clean start date." : "All time, 10+ votes incl. seed."}>
          <Rows head={["Battle", "A", "B"]} rows={s.closest.map((b) => [battleLink(b.slug, b.title), pct(b.a, b.total), pct(b.b, b.total)])} />
        </Section>
        <Section title="Most one-sided" note={view === "clean" ? "10+ real votes since the clean start date." : "All time, 10+ votes incl. seed."}>
          <Rows head={["Battle", "A", "B"]} rows={s.lopsided.map((b) => [battleLink(b.slug, b.title), pct(b.a, b.total), pct(b.b, b.total)])} />
        </Section>
      </div>
    </>
  );
}
