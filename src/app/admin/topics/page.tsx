import { topicsTestResults } from "@/server/services/topics-test";
import { TOPICS_ARM_LABELS, type TopicsCell } from "@/server/services/topics-test-rules";
import { topicLabel, deckTopic } from "@/lib/topics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Topics test" };

const pctN = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;

/**
 * Topics in the Vote deck A/B test (Alex, Nov 27 2026): its own dashboard so the answer is the first thing you see.
 * Service: services/topics-test.ts; pure stats: topics-test-rules.ts.
 */
export default async function TopicsTestPage() {
  const r = await topicsTestResults();
  const t = r.total;
  const tiles: [string, string, number | null, number | null][] = [
    ["Votes per visitor", `${t.control.avgVotes.toFixed(1)} → ${t.topics.avgVotes.toFixed(1)}`, r.votesLift, r.votesP],
    ["Sign-up rate", `${pctN(t.control.signupRate)} → ${pctN(t.topics.signupRate)}`, r.signupLift, r.signupP],
    ["Visitors who voted", `${pctN(t.control.voteRate)} → ${pctN(t.topics.voteRate)}`, r.voteRateLift, r.voteRateP],
    ["Came back another day (first 7 days)", `${pctN(t.control.returnRate)} → ${pctN(t.topics.returnRate)}`, r.returnLift, r.returnP],
  ];
  const funnel = new Map(r.funnel.map((f) => [f.name, f]));
  const f = (name: string) => funnel.get(name)?.people ?? 0;
  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-4">
        <div>
          <h2 className="font-sans text-lg font-medium">Topics in the Vote deck: old deck → topics</h2>
          <p className="text-xs text-zinc-500">
            {r.startedAt ? `Started ${r.startedAt} (New York). ` : ""}
            {r.pct}% of new browsers get topics (topicsTestPct in Config; 0 stops the test). Visitors so far: {t.control.visitors.toLocaleString()} old deck ·{" "}
            {t.topics.visitors.toLocaleString()} topics.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(([label, value, lift, p]) => (
            <div key={label} className="rounded-xl bg-surface p-3">
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="text-2xl tabular-nums">{value}</div>
              <div className="text-xs text-zinc-500">
                {lift == null ? "Not enough data yet" : `Topics ${lift >= 0 ? "+" : "−"}${Math.abs(Math.round(lift * 100))}% · `}
                {p == null ? "" : p < 0.05 ? <span className="text-green">real difference (p = {p.toFixed(3)})</span> : `could be chance (p = ${p.toFixed(2)})`}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Judge it on these totals after 4 to 5 days. Each visitor is a browser first seen during the test; votes include what it did after signing up.
          Seed votes, bots and admins are left out. Green means p &lt; 0.05.
        </p>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-sans font-medium">Did people use topics? (topics group)</h2>
        <Rows
          head={["Step", "People"]}
          rows={[
            ["Saw the topic chips", f("topic_bar_shown")],
            ["Picked a topic (any way)", `${t.topics.choseTopic} (${t.topics.visitors ? pctN(t.topics.choseTopic / t.topics.visitors) : "—"} of visitors)`],
            ["Saw “stay on Mix or get more specific?”", f("topic_picker_shown")],
            ["…skipped it", f("topic_picker_skipped")],
            ["Saw the streak card", f("topic_streak_shown")],
            ["…said yes", f("topic_streak_tap")],
            ["Ran out of a topic", f("topic_empty")],
            ["Hit the topic sign-up card", f("topic_gate_shown")],
          ]}
        />
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-sans font-medium">By topic (topics group)</h2>
        <p className="text-xs text-zinc-500">People who picked the topic, and votes made while the deck was on it.</p>
        <Rows
          head={["Topic", "People who picked it", "Votes on it", "Voters", "Votes per voter"]}
          rows={r.perTopic.map((p) => [topicLabel(deckTopic(p.topic)), p.pickers, p.votes, p.voters, p.voters ? (p.votes / p.voters).toFixed(1) : "—"])}
        />
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-sans font-medium">Day by day</h2>
        <p className="text-xs text-zinc-500">By the day the browser was first seen (New York). Newer days have had less time to vote, sign up and come back, so compare the two groups on the same day.</p>
        <Rows
          head={["Day", "Group", "Visitors", "Voted", "Votes per visitor", "Votes per visit", "Sign-ups", "Sign-up rate", "Came back"]}
          rows={[
            ...(["control", "topics"] as const).map((arm) => row("All days", arm, t[arm])),
            ...r.daily.flatMap((d) => (["control", "topics"] as const).map((arm) => row(d.day, arm, d[arm]))),
          ]}
        />
      </section>
    </div>
  );
}

function row(day: string, arm: "control" | "topics", c: TopicsCell): React.ReactNode[] {
  return [
    day === "All days" ? <b key="d">{day}</b> : day,
    TOPICS_ARM_LABELS[arm],
    c.visitors,
    `${c.voters} (${pctN(c.voteRate)})`,
    c.avgVotes.toFixed(1),
    c.votesPerSession.toFixed(1),
    c.signups,
    pctN(c.signupRate),
    `${c.returned} (${pctN(c.returnRate)})`,
  ];
}

function Rows({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="text-sm text-zinc-500">No data yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500">
            {head.map((h, i) => (
              <th key={h} className={`py-1 pr-2 font-normal ${i ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-ink/10">
              {r.map((c, j) => (
                <td key={j} className={`py-1.5 pr-2 ${j ? "text-right tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
