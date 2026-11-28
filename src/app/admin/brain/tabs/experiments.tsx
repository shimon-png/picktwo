import Link from "next/link";
import { ARM_LABELS } from "@/server/services/gate-test-rules";
import { TOPICS_ARM_LABELS } from "@/server/services/topics-test-rules";
import { Rows, gateRow, nyTime, pct, pctN, perVisitor, verdict, barVerdict, type TabProps } from "../ui";
import { TestCard, loadTests } from "../tests";

/** Every test on the same card, live ones first; the old per-test tables sit behind "Show details". */
export async function ExperimentsTab({ days, view }: TabProps) {
  const { gt, ab, pb, pk, wb, tp, summaries } = await loadTests(view, days);
  const order = [...summaries].sort((a, b) => Number(b.live) - Number(a.live));
  const pv = (p: number | null) => (p == null ? "no p yet" : p < 0.05 ? `real difference (p = ${p.toFixed(3)})` : `could be chance (p = ${p.toFixed(2)})`);
  const details: Record<string, React.ReactNode> = {
    topics: (
      <>
        <p className="text-xs text-zinc-500">
          New signed-out browsers (no votes yet) are split at random: {TOPICS_ARM_LABELS.control} vs {TOPICS_ARM_LABELS.topics} (chip row, &quot;stay on Mix?&quot; card, topic sign-up nudge). Came back = active on 2+ days in their first week.
          {tp.startedAt ? ` Started ${tp.startedAt} New York time.` : " Not started yet."}{" "}
          <Link href="/admin/topics" className="text-accent underline">Full dashboard (per topic, topic cards funnel)</Link>
        </p>
        <Rows
          head={["Metric", TOPICS_ARM_LABELS.control, TOPICS_ARM_LABELS.topics, "p"]}
          rows={[
            ["Visitors", tp.total.control.visitors, tp.total.topics.visitors, ""],
            ["Votes per visitor", tp.total.control.avgVotes.toFixed(2), tp.total.topics.avgVotes.toFixed(2), pv(tp.votesP)],
            ["Voted at all", pctN(tp.total.control.voteRate), pctN(tp.total.topics.voteRate), pv(tp.voteRateP)],
            ["Sign-up rate", pctN(tp.total.control.signupRate), pctN(tp.total.topics.signupRate), pv(tp.signupP)],
            ["Came back", pctN(tp.total.control.returnRate), pctN(tp.total.topics.returnRate), pv(tp.returnP)],
          ]}
        />
        <Rows
          head={["Day", `${TOPICS_ARM_LABELS.control}: visitors · votes/visitor · sign-up`, `${TOPICS_ARM_LABELS.topics}: visitors · votes/visitor · sign-up`]}
          rows={tp.daily.map((d) => [
            d.day,
            `${d.control.visitors} · ${d.control.avgVotes.toFixed(1)} · ${pctN(d.control.signupRate)}`,
            `${d.topics.visitors} · ${d.topics.avgVotes.toFixed(1)} · ${pctN(d.topics.signupRate)}`,
          ])}
        />
      </>
    ),
    gate: (
      <>
        <p className="text-xs text-zinc-500">{`Every new signed-out browser is put in a group at random and stays there. A (control): after ${gt.limit} free votes, a sign-up wall they can't skip. B: a sign-up dialog they can close and keep voting; it shows again every ${gt.every} votes. ${gt.pct}% go to B (gateTestPct in Config; 0 stops the test, everyone gets A). Rows are by the day the browser was first seen (New York). Votes count everything that browser did since, as a guest and in the account it signed up to. Reached the gate = saw the wall or dialog at least once.`}</p>
        {gt.startedAt ? (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {(
                [
                  ["Sign-up rate, A → B", `${pctN(gt.total.control.signupRate)} → ${pctN(gt.total.soft.signupRate)}`, gt.signupLift, gt.signupP],
                  ["Avg votes per visitor, A → B", `${gt.total.control.avgVotes.toFixed(1)} → ${gt.total.soft.avgVotes.toFixed(1)}`, gt.votesLift, gt.votesP],
                ] as const
              ).map(([label, value, lift, p]) => (
                <div key={label} className="rounded-xl bg-surface p-3 md:col-span-2">
                  <div className="text-xs text-zinc-500">{label}</div>
                  <div className="text-lg tabular-nums">{value}</div>
                  <div className="text-xs text-zinc-500">
                    {lift == null ? "Not enough data yet" : `B is ${lift >= 0 ? "+" : "−"}${Math.abs(Math.round(lift * 100))}% vs A · `}
                    {p == null ? "" : p < 0.05 ? <span className="text-green">real difference (p = {p.toFixed(3)})</span> : `could be chance (p = ${p.toFixed(2)})`}
                  </div>
                </div>
              ))}
            </div>
            <Rows
              head={["Day", "Group", "Visitors", "Votes", "Avg votes per visitor", "Reached the gate", "Sign-ups", "Sign-up rate"]}
              rows={[
                ...(["control", "soft"] as const).map((arm) => gateRow(<b key="t">All days</b>, ARM_LABELS[arm], gt.total[arm])),
                ...gt.daily.flatMap((d) => (["control", "soft"] as const).map((arm) => gateRow(d.day, ARM_LABELS[arm], d[arm]))),
              ]}
            />
            <p className="text-xs text-zinc-500">
              Test started {nyTime(gt.startedAt)}. Judge it on the All days rows once each group has a few hundred visitors; a green
              &quot;real difference&quot; means p &lt; 0.05. Newer days have had less time to vote and sign up, so compare A and B on the same day,
              not one day with another.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">{gt.pct > 0 ? "Running: no signed-out visitors yet." : "Off (gateTestPct is 0 in Config)."}</p>
        )}
      </>
    ),
    about: (
      <>
          <div className="rounded-xl bg-surface p-3">
            <div className="text-xs text-zinc-500">Votes per visitor, no-cards group → sees cards (this window)</div>
            <div className="text-2xl tabular-nums">
              {perVisitor(ab.arms.holdout)} → {perVisitor(ab.arms.cards)}
            </div>
            <div className="text-xs text-zinc-500">
              {verdict(ab.arms.holdout, ab.arms.cards, ab.holdoutP)}
            </div>
          </div>
        {ab.versions.length > 0 && (
          <>
            <h3 id="cards-versions" className="scroll-mt-4 pt-2 font-sans text-sm font-medium">Cards v1 vs v2</h3>
            <p className="text-xs text-zinc-500">
              v1 = sex, age, relationship, ZIP (from {nyTime(ab.versions[0].from)}). v2 = no ZIP card; kids, education, home, race, party without
              an account (starts by itself at the first new question shown{ab.versions[1] ? `: ${nyTime(ab.versions[1].from)}` : ", not yet"}). Whole
              version, not the day window. Goal: v2 keeps or raises votes per visitor AND learns more per visitor. The no-cards rows show what
              the same days looked like without cards.
            </p>
            <Rows
              head={["Version", "Group", "Visitors", "Votes per visitor", "Voters per visitor", "Answers per visitor", "Answered 1+", "Holdout vs cards"]}
              rows={ab.versions.flatMap((v) =>
                (["cards", "holdout"] as const).map((k) => [
                  <b key="v">{v.version}</b>,
                  k === "cards" ? "Sees cards" : `No cards (${ab.holdoutPct}%)`,
                  v[k].visitors,
                  perVisitor(v[k]),
                  v[k].visitors ? (v[k].voters / v[k].visitors).toFixed(2) : "—",
                  k === "cards" ? (v[k].visitors ? (v[k].answers / v[k].visitors).toFixed(2) : "—") : "—",
                  k === "cards" ? pct(v[k].answered, v[k].visitors) : "—",
                  k === "cards" ? <span key="p" className="text-xs">{verdict(v.holdout, v.cards, v.votesP)}</span> : "",
                ]),
              )}
            />
          </>
        )}
      </>
    ),
    "profile-bar": (
      <>
        <Rows
          head={["Group", "Visitors", "Votes", "Votes per visitor", `Reached ${pb.target} votes`]}
          rows={(["bar", "holdout"] as const).map((k) => [
            k === "bar" ? "Sees the bar" : `Holdout (${pb.holdoutPct}%, no bar)`,
            pb.arms[k].visitors,
            pb.arms[k].votes,
            pb.arms[k].visitors ? (pb.arms[k].votes / pb.arms[k].visitors).toFixed(2) : "—",
            pct(pb.arms[k].reached, pb.arms[k].visitors),
          ])}
        />
        <p className="text-xs text-zinc-500">{barVerdict(pb.arms.holdout, pb.arms.bar, pb.p)}</p>
      </>
    ),
    pickbot: (
      <>
        <Rows
          head={["Group (accounts)", "Visitors", "Votes", "Votes per visitor"]}
          rows={(["pickbot", "holdout"] as const).map((k) => [
            k === "pickbot" ? "Has Pickbot" : `Holdout (${pk.holdoutPct}%, no Pickbot)`,
            pk.arms[k].visitors,
            pk.arms[k].votes,
            pk.arms[k].visitors ? (pk.arms[k].votes / pk.arms[k].visitors).toFixed(2) : "—",
          ])}
        />
        <p className="text-xs text-zinc-500">{pk.holdoutP == null ? "Holdout: not enough data yet." : `Holdout difference: ${pk.holdoutP < 0.05 ? "real" : "could be chance"} (p = ${pk.holdoutP.toFixed(3)}).`}</p>
      </>
    ),
    "pickbot-promo": (
      <>
        <p className="pt-2 text-sm font-medium">“Ask Pickbot” card in the Vote deck: which position works best</p>
        <p className="text-xs text-zinc-500">
          {pk.promoOn ? "On" : "Off (Config pickbotPromo = 0)"}. Each signed-in person who hasn’t asked Pickbot yet sees it once, after a stable random number of
          picks in one deck visit (never the first 3). Active = used the deck in the window; reached = got that far in one visit. The fairest
          comparison is <b>asked per active person</b>: it counts people who never got far enough too.
        </p>
        <Rows
          head={["After pick", "Active", "Reached", "Saw it", "Tapped", "Asked (7 days)", "Tap rate", "Asked / saw", "Asked / active"]}
          rows={pk.promo.map((r) => {
            const best = Math.max(...pk.promo.map((x) => (x.active >= 20 ? x.asked / x.active : 0)));
            const rate = r.active ? r.asked / r.active : 0;
            return [
              r.at,
              r.active,
              r.reached,
              r.saw,
              r.tapped,
              r.asked,
              pct(r.tapped, r.saw),
              pct(r.asked, r.saw),
              <span key="b" className={r.active >= 20 && rate === best && best > 0 ? "font-semibold text-green" : undefined}>
                {pct(r.asked, r.active)}
              </span>,
            ];
          })}
        />
      </>
    ),
    winback: (
      <>
        <Rows
          head={["Group", "People", "Voted within 3 days", "Rate"]}
          rows={wb.arms.map((r) => [r.arm === "email" ? "Got the email" : "No email (holdout)", r.people, r.back3, pct(r.back3, r.people)])}
        />
      </>
    ),
  };
  return (
    <>
      <p className="text-xs text-zinc-500">
        Every test on one card: the arms side by side on the metric that decides it. Badges: Too early (under 300 people in an arm, or no p-value yet),
        &quot;… ahead&quot; (p &lt; 0.05), No difference, Off. Judge tests over 4+ days so daily noise evens out.
      </p>
      {order.map((x) => (
        <TestCard key={x.id} t={x}>
          {details[x.id]}
        </TestCard>
      ))}
    </>
  );
}
