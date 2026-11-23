import Link from "next/link";
import { getBrainStats } from "@/server/services/brain";
import { tasteByGroup } from "@/server/services/taste-profiles";
import { winbackStats } from "@/server/services/winback";
import { RecomputeEngagement, TagBattles } from "@/components/admin/AdminActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brain" };

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");
const secs = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-sans font-medium">{title}</h2>
      {note && <p className="text-xs text-zinc-500">{note}</p>}
      {children}
    </section>
  );
}

function Rows({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="text-sm text-zinc-500">No data yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500">
            {head.map((h, i) => (
              <th key={h} className={`py-1 pr-2 font-normal ${i ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-ink/10">
              {r.map((c, j) => (
                <td key={j} className={`py-1.5 pr-2 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const battleLink = (slug: string, title: string) => (
  <Link href={`/b/${slug}`} className="line-clamp-2 underline-offset-2 hover:underline">{title}</Link>
);

export default async function BrainPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const [s, taste, wb] = await Promise.all([getBrainStats(days), tasteByGroup(), winbackStats()]);
  const t = s.tiles;
  const n = (k: string) => Number(t[k] ?? 0);
  const tiles: [string, string | number][] = [
    ["Visits", n("sessions")],
    ["Visitors", n("visitors")],
    ["Cards viewed", n("views")],
    ["Deck votes per view", pct(n("deck_votes"), n("views"))],
    ["Real votes", n("real_votes")],
    ["Median time to pick", secs(t.median_pick_ms)],
    ["Skips", n("skips")],
    ["Hit sign-up wall", n("gates")],
    ["Sign-ups", n("signups")],
    ["Vote changes", n("changed")],
    ["Real battles posted", n("real_battles")],
    ["Seed votes (all time, excluded)", n("seed_votes_all")],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[22px]">Brain</h2>
        {[1, 7, 30].map((d) => (
          <Link key={d} href={`/admin/brain?days=${d}`} className={`chip !py-1 text-xs ${d === days ? "chip-on" : ""}`}>
            {d === 1 ? "24h" : `${d} days`}
          </Link>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Real data only (no seed votes, flagged votes or bots). Event tracking started Nov 23 2026. Hypotheses and requests live in the repo under docs/brain/.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-xs text-zinc-500">{k}</div>
            <div className="text-2xl font-medium">{v}</div>
          </div>
        ))}
      </div>

      <Section
        title="Engagement score (Shimon)"
        note="Share of a battle's real voters who came back 1–3 days later (next day counts most). Updates live when a voter returns, plus a full recount daily. Needs 3+ voters with a day to come back."
      >
        <div><RecomputeEngagement /></div>
        <Rows
          head={["Battle", "Score", "Voters", "Came back", "Type"]}
          rows={s.topEngaging.map((b) => [
            battleLink(b.slug, b.title),
            Math.round(b.score * 100),
            b.voters,
            Number(b.returns).toFixed(1),
            `${b.kind}${b.seed ? " · seed" : ""}`,
          ])}
        />
      </Section>

      <Section
        title="By theme (AI tags)"
        note="Each battle is tagged by AI when posted: theme, stakes, and what picking each side suggests about the voter. Real votes are all-time; views are for the selected window."
      >
        <div><TagBattles remaining={s.untagged} /></div>
        <Rows
          head={["Theme", "Battles", "Real votes", "Vote rate", "Avg score"]}
          rows={s.byTheme.map((r) => [r.tag.replace(/_/g, " "), r.battles, r.real_votes, pct(r.voted_views, r.views), r.score == null ? "—" : Math.round(r.score * 100)])}
        />
      </Section>

      <Section
        title="What groups lean toward (taste profiles)"
        note={`From picks on AI-tagged battles by ${taste.people} signed-in people with data consent on (${taste.picks} picks). Groups only, shown once they have ${taste.minGroup}+ people. "1.6×" = this trait shows up 1.6 times as often in the group's picks as in everyone's.`}
      >
        <Rows
          head={["Group", "People", "Leans toward"]}
          rows={taste.groups.map((g) => [
            g.group,
            g.people,
            g.leans.length ? g.leans.map((l) => `${l.trait.replace(/_/g, " ")} ${l.lift.toFixed(1)}×`).join(", ") : "No clear lean yet",
          ])}
        />
      </Section>

      <Section title="By stakes" note="Small (snack, nail colour), medium (event outfit, gadget), big (house, job, proposal).">
        <Rows
          head={["Stakes", "Battles", "Real votes", "Vote rate", "Avg score"]}
          rows={s.byStakes.map((r) => [r.tag, r.battles, r.real_votes, pct(r.voted_views, r.views), r.score == null ? "—" : Math.round(r.score * 100)])}
        />
      </Section>

      <Section title="Text vs photo" note="Views in the Vote deck, and how many turned into a vote by the same person.">
        <Rows head={["Card type", "Views", "Voted", "Vote rate", "Median pick"]} rows={s.byKind.map((k) => [k.kind ?? "?", k.views, k.voted, pct(k.voted, k.views), secs(k.median_ms)])} />
      </Section>

      <Section title="Where visits come from" note="UTM source, else the referring site, else direct.">
        <Rows head={["Source", "Visits", "Visitors", "Voted", "Voter rate"]} rows={s.sources.map((r) => [r.source, r.sessions, r.visitors, r.voters, pct(r.voters, r.visitors)])} />
      </Section>

      <Section
        title="Win-back emails"
        note={`${wb.enabled ? "On" : "Off (economy setting winbackEmails = 1 turns it on)"}. ${wb.lapsingNow} people are drifting away right now. ${wb.holdoutPct}% of them get no email so we can compare. Last 30 days:`}
      >
        <Rows
          head={["Group", "People", "Voted within 3 days", "Rate"]}
          rows={wb.arms.map((r) => [r.arm === "email" ? "Got the email" : "No email (holdout)", r.people, r.back3, pct(r.back3, r.people)])}
        />
      </Section>

      <Section title="Next-day return" note="People first seen that day (New York time) who visited again the next day.">
        <Rows head={["First seen", "New visitors", "Back next day", "Rate"]} rows={s.retention.map((r) => [r.day, r.new_visitors, r.back_d1, pct(r.back_d1, r.new_visitors)])} />
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="How deep people go" note="Cards viewed by position in the deck.">
          <Rows head={["Position", "Views"]} rows={s.depth.map((d) => [d.bucket, d.views])} />
        </Section>
        <Section title="How people pick">
          <Rows head={["Method", "Votes"]} rows={s.methods.map((m) => [m.method, m.n])} />
        </Section>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Closest to 50/50" note="All time, 10+ real votes.">
          <Rows head={["Battle", "A", "B"]} rows={s.closest.map((b) => [battleLink(b.slug, b.title), pct(b.a, b.total), pct(b.b, b.total)])} />
        </Section>
        <Section title="Most one-sided" note="All time, 10+ real votes.">
          <Rows head={["Battle", "A", "B"]} rows={s.lopsided.map((b) => [battleLink(b.slug, b.title), pct(b.a, b.total), pct(b.b, b.total)])} />
        </Section>
      </div>
    </div>
  );
}
