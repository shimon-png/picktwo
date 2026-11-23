import Link from "next/link";
import { journeyData, median, type Visitor } from "@/server/services/journey";
import type { BrainView } from "@/server/services/brain";
import { Sankey, type SankeyLink, type SankeyNode } from "@/components/admin/Sankey";
import type { Source } from "@/server/services/acquisition-rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journey" };

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

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

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-sans font-medium">{title}</h2>
      {note && <p className="text-xs text-zinc-500">{note}</p>}
      {children}
    </section>
  );
}

const SHORT: Record<Source, string> = {
  x_campaign: "X ads",
  x_organic: "X links",
  other_campaign: "Other ads",
  referral: "Other sites",
  direct: "Direct",
  unknown: "Unknown",
};

function flow(vs: Visitor[]) {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const sources = [...new Set(vs.map((v) => v.source))];
  for (const s of sources) {
    const n = vs.filter((v) => v.source === s).length;
    nodes.push({ id: `s:${s}`, col: 0, label: SHORT[s], value: n, tone: s.startsWith("x_") ? "blue" : "grey" });
    links.push({ from: `s:${s}`, to: "visitors", value: n, tone: s.startsWith("x_") ? "blue" : "grey" });
  }
  const voted = vs.filter((v) => v.votes > 0);
  const sawNoVote = vs.filter((v) => v.votes === 0 && v.cards > 0);
  const bounced = vs.filter((v) => v.votes === 0 && v.cards === 0);
  const signed = voted.filter((v) => v.signedUp);
  const noSign = voted.filter((v) => !v.signedUp);
  const back = signed.filter((v) => v.days >= 2);
  const notBack = signed.filter((v) => v.days < 2);
  const guestBack = noSign.filter((v) => v.days >= 2);
  const guestGone = noSign.filter((v) => v.days < 2);
  nodes.push(
    { id: "visitors", col: 1, label: "Visitors", value: vs.length, tone: "grey" },
    { id: "voted", col: 2, label: "Voted", value: voted.length, tone: "green" },
    { id: "saw", col: 2, label: "Saw cards, no vote", value: sawNoVote.length, tone: "red" },
    { id: "bounced", col: 2, label: "Left before a card", value: bounced.length, tone: "red" },
    { id: "signed", col: 3, label: "Signed up", value: signed.length, tone: "green" },
    { id: "nosign", col: 3, label: "Voted, no sign-up", value: noSign.length, tone: "red" },
    { id: "back", col: 4, label: "Came back another day", value: back.length, tone: "green" },
    { id: "notback", col: 4, label: "Not back yet", value: notBack.length, tone: "red" },
    { id: "guestback", col: 4, label: "Guest came back", value: guestBack.length, tone: "green" },
    { id: "guestgone", col: 4, label: "Guest gone", value: guestGone.length, tone: "red" },
  );
  links.push(
    { from: "visitors", to: "voted", value: voted.length, tone: "green" },
    { from: "visitors", to: "saw", value: sawNoVote.length, tone: "red" },
    { from: "visitors", to: "bounced", value: bounced.length, tone: "red" },
    { from: "voted", to: "signed", value: signed.length, tone: "green" },
    { from: "voted", to: "nosign", value: noSign.length, tone: "red" },
    { from: "signed", to: "back", value: back.length, tone: "green" },
    { from: "signed", to: "notback", value: notBack.length, tone: "red" },
    { from: "nosign", to: "guestback", value: guestBack.length, tone: "green" },
    { from: "nosign", to: "guestgone", value: guestGone.length, tone: "red" },
  );
  return { nodes, links, voted, signed, back };
}

export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ days?: string; view?: string }> }) {
  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const view: BrainView = sp.view === "all" ? "all" : "clean";
  const href = (o: { days?: number; view?: BrainView }) => `/admin/journey?days=${o.days ?? days}${(o.view ?? view) === "all" ? "&view=all" : ""}`;
  const { visitors: vs, byKind, byTheme, scope } = await journeyData(view, days);
  const f = flow(vs);
  const returners = vs.filter((v) => v.days >= 2);
  const oneTime = vs.filter((v) => v.days < 2 && v.votes > 0);
  const posted = vs.filter((v) => v.posted).length;
  const sources = [...new Set(vs.map((v) => v.source))];

  const tiles: [string, string | number][] = [
    ["Visitors", vs.length],
    ["Voted", `${f.voted.length} (${pct(f.voted.length, vs.length)})`],
    ["Signed up (of voters)", `${f.signed.length} (${pct(f.signed.length, f.voted.length)})`],
    ["Came back another day", `${returners.length} (${pct(returners.length, vs.length)})`],
    ["Posted a battle", posted],
    ["Median votes: back vs one-time", `${median(returners.map((v) => v.votes))} vs ${median(oneTime.map((v) => v.votes))}`],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[22px]">Customer journey</h2>
        {(["clean", "all"] as const).map((v) => (
          <Link key={v} href={href({ view: v })} className={`chip !py-1 text-xs ${v === view ? "chip-on" : ""}`}>
            {v === "clean" ? "Clean" : "All data (AI view)"}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-ink/15" aria-hidden />
        {[1, 7, 30].map((d) => (
          <Link key={d} href={href({ days: d })} className={`chip !py-1 text-xs ${d === days ? "chip-on" : ""}`}>
            {d === 1 ? "24h" : `${d} days`}
          </Link>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        One person = an account, or a browser not linked to one. Same filters as the Brain ({view === "clean" ? "Clean: real people only, from the clean start date" : "All data: includes seed and test activity"}).
        Came back = visited on a second New York day. Green keeps going, red drops off; hover a band for its count.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-xs text-zinc-500">{k}</div>
            <div className="text-xl font-medium">{v}</div>
          </div>
        ))}
      </div>

      <Section title="Where people come from and where they drop off">
        {vs.length ? <Sankey nodes={f.nodes} links={f.links} /> : <p className="text-sm text-zinc-500">No visitors yet in this window.</p>}
      </Section>

      <Section title="By source" note="Each step as a share of the step before it.">
        <Rows
          head={["Source", "Visitors", "Voted", "Signed up / voters", "Came back", "Avg votes"]}
          rows={sources.map((s) => {
            const g = vs.filter((v) => v.source === s);
            const gv = g.filter((v) => v.votes > 0);
            return [
              SHORT[s],
              g.length,
              pct(gv.length, g.length),
              pct(gv.filter((v) => v.signedUp).length, gv.length),
              pct(g.filter((v) => v.days >= 2).length, g.length),
              g.length ? (g.reduce((a, v) => a + v.votes, 0) / g.length).toFixed(1) : "—",
            ];
          })}
        />
      </Section>

      <Section title="How many votes before they're hooked" note="Of people who voted, how many came back another day, by how many votes they cast in the window.">
        <Rows
          head={["Votes", "People", "Came back", "Rate"]}
          rows={[
            ["1–2", (v: Visitor) => v.votes >= 1 && v.votes <= 2],
            ["3–5", (v: Visitor) => v.votes >= 3 && v.votes <= 5],
            ["6–10", (v: Visitor) => v.votes >= 6 && v.votes <= 10],
            ["11+", (v: Visitor) => v.votes > 10],
          ].map(([label, test]) => {
            const g = vs.filter(test as (v: Visitor) => boolean);
            const b = g.filter((v) => v.days >= 2).length;
            return [label as string, g.length, b, pct(b, g.length)];
          })}
        />
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="What they vote on: card type" note="Share of votes by people who came back vs people who didn't.">
          <Rows head={["Type", "Came back", "Didn't"]} rows={byKind.map((r) => [r.label, `${Math.round(r.backShare * 100)}%`, `${Math.round(r.goneShare * 100)}%`])} />
        </Section>
        <Section title="What they vote on: theme" note="AI tags (needs OPENAI_API_KEY; untagged until then).">
          <Rows head={["Theme", "Came back", "Didn't"]} rows={byTheme.slice(0, 12).map((r) => [r.label, `${Math.round(r.backShare * 100)}%`, `${Math.round(r.goneShare * 100)}%`])} />
        </Section>
      </div>
      {scope.cleanFrom && <p className="text-xs text-zinc-500">Clean data starts {new Date(scope.cleanFrom).toLocaleDateString("en-US", { timeZone: "America/New_York" })}.</p>}
    </div>
  );
}
