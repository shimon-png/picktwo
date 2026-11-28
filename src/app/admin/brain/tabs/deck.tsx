import { getBrainStats } from "@/server/services/brain";
import { skipStats } from "@/server/services/skip-stats";
import { themeEngagementData } from "@/server/services/brain-themes";
import { themeEngagement, themeHighlights } from "@/server/services/theme-engagement-rules";
import { themeLabel } from "@/lib/theme-guess";
import { RecomputeEngagement, TagBattles } from "@/components/admin/AdminActions";
import { RankBars, ThemeDots } from "../charts";
import { Num, POS_RANGE, Rows, Section, ShowMore, battleLink, makeListHref, nyTime, pct, pctOf, secs, type TabProps } from "../ui";

/** What works in the Vote deck: engagement score, themes (with stakes and card type), skips, where bouncers left. */
export async function DeckTab({ days, view }: TabProps) {
  const listHref = makeListHref(days, view);
  const [s, sk, te] = await Promise.all([
    getBrainStats(days, view),
    skipStats(view, days),
    loadThemes(days, view),
  ]);
  const themeHeadlines = themeHighlights(te, themeLabel);
  const viewedTotal = s.byKind.reduce((a, k) => a + k.seen, 0);
  const viewedVoted = s.byKind.reduce((a, k) => a + k.voted, 0);
  const votesByKind = (k: string) => s.votePlaces.filter((r) => r.kind === k).reduce((a, r) => a + r.n, 0);
  const placeTotal = s.votePlaces.reduce((a, r) => a + r.n, 0);
  const kinds = [...new Set(["text", "photo", ...s.byKind.map((k) => k.kind ?? "?")])];
  const bottomEngaging = s.bottomEngaging;
  return (
    <>
      <Section
        title="Engagement score (Shimon)"
        note="Share of a battle's real voters who came back 1–3 days later (next day counts most). All-time score from real votes only (seed votes never count), so seed battles can rank too. Updates live when a voter returns, plus a full recount daily. Needs 3+ voters with a day to come back."
      >
        <div><RecomputeEngagement /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="pb-1 text-xs font-medium">Most come-back-worthy battles</p>
            <RankBars
              rows={s.topEngaging.slice(0, 10).map((b) => ({
                key: b.slug,
                label: battleLink(b.slug, b.title),
                sub: `${b.voters} voters · ${b.kind}${b.seed ? " · seed" : ""}`,
                value: Number(b.score),
                display: String(Math.round(Number(b.score) * 100)),
              }))}
              max={1}
            />
          </div>
          <div>
            <p className="pb-1 text-xs font-medium">Least (candidates to retire)</p>
            <RankBars
              rows={bottomEngaging.map((b) => ({
                key: b.slug,
                label: battleLink(b.slug, b.title),
                sub: `${b.voters} voters · ${b.kind}${b.seed ? " · seed" : ""}`,
                value: Number(b.score),
                display: String(Math.round(Number(b.score) * 100)),
              }))}
              max={1}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Which themes work"
        note={`Every battle real people saw, voted on or skipped in this window, grouped by theme (${te.totals.aiTagged} of ${te.totals.battles} battles have an AI tag; the rest, mostly seed battles, are matched by their words). Seen = a Vote deck card, once per person. Vote rate = seen cards the person voted on; Skip rate = Skip button presses ÷ seen; Left on it = seen, no vote, no skip (they closed the app on it). All votes = every counted vote from any screen (adds up to the Votes tile). % of voters = share of all ${te.totals.voters} people who voted that voted on this theme at least once; % of sign-ups = the same for the ${te.totals.signups} people who signed up in this window. Last card before bouncing = visitors with no account who never came back on another day, by the theme of the last battle they saw.`}
      >
        {te.error && <p className="text-sm text-b">Couldn&apos;t load the theme numbers: {te.error}. Tell Claude.</p>}
        {themeHeadlines.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {themeHeadlines.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
        <ThemeDots
          dots={te.themes
            .filter((r) => r.seen >= 10 && r.voteRate != null && r.skipRate != null)
            .map((r) => ({ key: r.theme, label: themeLabel(r.theme), vote: r.voteRate!, skip: r.skipRate!, seen: r.seen }))}
          avgVote={te.totals.seen ? te.totals.voted / te.totals.seen : null}
          avgSkip={te.totals.seen ? te.totals.skipped / te.totals.seen : null}
        />
        <ShowMore label="Show the theme table">
        <Rows
          head={["Theme", "Battles", "People who saw", "Seen", "Voted", "Vote rate", "Skipped", "Skip rate", "Left on it", "All votes", "Voters (% of voters)", "Sign-ups who voted (% of sign-ups)", "Last card before bouncing"]}
          rows={[
            ...te.themes.map((r) => [
              themeLabel(r.theme),
              r.battles,
              r.seenPeople,
              r.seen,
              r.voted,
              pctOf(r.voteRate),
              r.skipped,
              pctOf(r.skipRate),
              r.left,
              r.votes,
              `${r.voters} (${pctOf(r.pctVoters)})`,
              `${r.signupVoters} (${pctOf(r.pctSignups)})`,
              r.bounceLast ? `${r.bounceLast} (${pctOf(r.pctBounced)})` : "—",
            ]),
            [<b key="t">Total</b>, te.totals.battles, "", te.totals.seen, te.totals.voted, pct(te.totals.voted, te.totals.seen), te.totals.skipped, pct(te.totals.skipped, te.totals.seen), te.totals.left, te.totals.votes, `${te.totals.voters} people`, `${te.totals.signupVoters} of ${te.totals.signups}`, te.totals.bounced - te.totals.bouncedNoBattle],
          ]}
        />
        <details>
          <summary className="cursor-pointer text-sm text-accent">Theme × text / photo</summary>
          <Rows
            head={["Theme", "Type", "Battles", "Seen", "Vote rate", "Skip rate", "Left on it", "All votes", "% of voters", "% of sign-ups"]}
            rows={te.themeKinds.map((r) => [themeLabel(r.theme), r.kind, r.battles, r.seen, pctOf(r.voteRate), pctOf(r.skipRate), r.left, r.votes, pctOf(r.pctVoters), pctOf(r.pctSignups)])}
          />
        </details>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <TagBattles remaining={s.untagged} /> AI-tag the rest so seed battles use the AI theme instead of the word match.
          {s.tagging && (
            <span className={s.tagging.failed ? "text-b" : undefined}>
              Last run {nyTime(s.tagging.at)}: {s.tagging.tagged} tagged
              {s.tagging.failed ? `, ${s.tagging.failed} failed${s.tagging.error ? ` (${s.tagging.error})` : ""}` : ""}
            </span>
          )}
        </div>
          <p className="pt-2 text-sm font-medium">By stakes</p>
          <p className="text-xs text-zinc-500">AI-tagged battles only (seed battles too, once tagged). Small (snack, nail colour), medium (event outfit, gadget), big (house, job, proposal).</p>
        <Rows
          head={["Stakes", "Battles", "Votes", "Vote rate", "Avg score"]}
          rows={s.byStakes.map((r) => [r.tag, r.battles, r.real_votes, pct(r.voted_views, r.views), r.score == null ? "—" : Math.round(r.score * 100)])}
        />
          <p className="pt-2 text-sm font-medium">Text vs photo</p>
          <p className="text-xs text-zinc-500">All votes = every counted vote from any place, so this column adds up to the votes total. The other columns are the Vote deck only: Times shown counts every display, Cards seen counts each person × battle once, and Seen → voted counts the cards that person then voted on.</p>
        <Rows
          head={["Card type", "All votes", "Times shown", "Cards seen", "Seen → voted", "Vote rate", "Median pick"]}
          rows={[
            ...kinds.map((k) => {
              const d = s.byKind.find((r) => (r.kind ?? "?") === k);
              const kq = k === "text" || k === "photo" ? { kind: k } : undefined;
              return [
                k,
                <Num key="v" n={votesByKind(k)} href={listHref("votes", undefined, kq)} />,
                d?.views ?? 0,
                <Num key="s" n={d?.seen ?? 0} href={listHref("cards", undefined, kq)} />,
                <Num key="sv" n={d?.voted ?? 0} href={listHref("cards", undefined, { ...kq, outcome: "voted" })} />,
                pct(d?.voted ?? 0, d?.seen ?? 0),
                secs(d?.median_ms ?? null),
              ];
            }),
            [
              "Total",
              <Num key="v" n={placeTotal} href={listHref("votes")} />,
              s.byKind.reduce((a, k) => a + k.views, 0),
              <Num key="s" n={viewedTotal} href={listHref("cards")} />,
              <Num key="sv" n={viewedVoted} href={listHref("cards", undefined, { outcome: "voted" })} />,
              pct(viewedVoted, viewedTotal),
              "",
            ],
          ]}
        />
        </ShowMore>
      </Section>

      <Section
        title="Where bounced visitors left"
        note="Bounced = a visitor with no account who was active on one New York day only, and that day is over (seen 24h+ ago). Their last battle = the newest battle they saw, voted on or skipped. Compare a theme's share of last cards with its share of everything seen: a theme people leave on much more often than they see it (index above 1.0) is a bounce theme."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Bounced visitors", te.totals.bounced],
              ["Left before seeing a battle", te.totals.bouncedNoBattle],
              ["Left after seeing a battle", te.totals.bounced - te.totals.bouncedNoBattle],
              ["Avg votes before leaving", te.bounce.avgVotesBeforeLeaving == null ? "—" : te.bounce.avgVotesBeforeLeaving.toFixed(1)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface p-2.5">
              <div className="text-xs text-zinc-500">{k}</div>
              <div className="text-xl font-medium">{v}</div>
            </div>
          ))}
        </div>
        <Rows
          head={["Theme of last battle", "Bounced people", "Share of bounces", "Share of all cards seen", "Index", "In their last 3 battles"]}
          rows={te.themes
            .filter((r) => r.bounceLast > 0)
            .sort((a, b) => b.bounceLast - a.bounceLast)
            .map((r) => [
              themeLabel(r.theme),
              r.bounceLast,
              pctOf(r.pctBounced),
              pctOf(r.pctSeen),
              r.pctBounced != null && r.pctSeen ? (r.pctBounced / r.pctSeen).toFixed(1) : "—",
              te.bounce.lastThree.find((x) => x.theme === r.theme)?.n ?? 0,
            ])}
        />
        <Rows
          head={["Last battle before leaving", "Theme", "Type", "People", "Voted on it", "Skipped it", "Left on it"]}
          rows={te.bounce.lastBattles.slice(0, 20).map((b) => [b.slug ? battleLink(b.slug, b.title) : b.title, themeLabel(b.theme), b.kind, b.people, b.voted, b.skipped, b.left])}
        />
      </Section>

      <Section
        title="Voted vs skipped"
        note={`Every Vote deck card a person saw in this window (person × battle, counted once) ends one way: voted, skipped, or neither (they left, reloaded or switched tab while it was on top). Skip rate = skipped ÷ (voted + skipped). The deck uses the same signal: battles people vote on move up, ones they skip move down (economy skipWeight; the 10% engagement holdout keeps the old order).`}
      >
        <Rows
          head={["Card type", "Cards seen", "Voted", "Skipped", "Neither", "Skip rate", "Left on it"]}
          rows={[
            ...sk.byKind.map((r) => {
              const kq: Record<string, string> = r.kind === "text" || r.kind === "photo" ? { kind: r.kind } : {};
              return [
                r.kind,
                <Num key="s" n={r.seen} href={listHref("cards", undefined, kq)} />,
                <Num key="v" n={r.voted} href={listHref("cards", undefined, { ...kq, outcome: "voted" })} />,
                <Num key="k" n={r.skipped} href={listHref("cards", undefined, { ...kq, outcome: "skipped" })} />,
                <Num key="n" n={r.neither} href={listHref("cards", undefined, { ...kq, outcome: "neither" })} />,
                pct(r.skipped, r.voted + r.skipped),
                pct(r.neither, r.seen),
              ];
            }),
            [
              "Total",
              <Num key="s" n={sk.total.seen} href={listHref("cards")} />,
              <Num key="v" n={sk.total.voted} href={listHref("cards", undefined, { outcome: "voted" })} />,
              <Num key="k" n={sk.total.skipped} href={listHref("cards", undefined, { outcome: "skipped" })} />,
              <Num key="n" n={sk.total.neither} href={listHref("cards", undefined, { outcome: "neither" })} />,
              pct(sk.total.skipped, sk.total.voted + sk.total.skipped),
              pct(sk.total.neither, sk.total.seen),
            ],
          ]}
        />
        <ShowMore label="By deck position, most and least skipped">
        <Rows
          head={["Position", "Cards seen", "Voted", "Skipped", "Neither", "Skip rate"]}
          rows={sk.byPos.map((r) => {
            const pq = POS_RANGE[r.bucket];
            const cell = (key: string, v: number, outcome?: string) =>
              pq ? <Num key={key} n={v} href={listHref("cards", undefined, { pos: pq, ...(outcome ? { outcome } : {}) })} /> : v;
            return [r.bucket, cell("s", r.seen), cell("v", r.voted, "voted"), cell("k", r.skipped, "skipped"), cell("n", r.neither, "neither"), pct(r.skipped, r.voted + r.skipped)];
          })}
        />
          <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">Most skipped battles</p>
          <p className="text-xs text-zinc-500">{`Battles seen by 5+ people in this window (${sk.battlesRated} so far), highest skip rate first. Candidates to rewrite, relaunch with a better photo, or hide.`}</p>
          <Rows
            head={["Battle", "Seen", "Skip rate"]}
            rows={sk.mostSkipped.map((b) => [
              battleLink(b.slug, b.title),
              <Num key="s" n={b.seen} href={listHref("cards", undefined, { battle: b.slug })} />,
              <Num key="r" n={b.skipped} href={listHref("cards", undefined, { battle: b.slug, outcome: "skipped" })}>{pct(b.skipped, b.voted + b.skipped)}</Num>,
            ])}
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Least skipped battles</p>
          <p className="text-xs text-zinc-500">Same rule, lowest skip rate first. What these have in common is what to post more of.</p>
          <Rows
            head={["Battle", "Seen", "Skip rate"]}
            rows={sk.leastSkipped.map((b) => [
              battleLink(b.slug, b.title),
              <Num key="s" n={b.seen} href={listHref("cards", undefined, { battle: b.slug })} />,
              <Num key="r" n={b.skipped} href={listHref("cards", undefined, { battle: b.slug, outcome: "skipped" })}>{pct(b.skipped, b.voted + b.skipped)}</Num>,
            ])}
          />
        </div>
          </div>
        </ShowMore>
      </Section>

        <Section collapsed title="How deep people go" note="Deck cards shown, by position in the deck (adds up to the Deck cards shown tile).">
          <Rows head={["Position", "Times shown"]} rows={s.depth.map((d) => [d.bucket, d.views])} />
        </Section>
    </>
  );
}

/** A failure here must never take the whole tab down: show the error in the theme section instead. */
export function loadThemes(days: number, view: TabProps["view"]) {
  return themeEngagementData(days, view)
    .then((r) => ({ ...r, error: null as string | null }))
    .catch((e: unknown) => {
      console.error("[brain] theme engagement", e);
      return { ...themeEngagement({ battles: new Map(), seen: [], votes: [], skips: [], people: new Map(), signups: 0 }), error: e instanceof Error ? e.message : String(e) };
    });
}
