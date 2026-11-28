import Link from "next/link";
import { aboutStats } from "@/server/services/about-stats";
import { mindStats } from "@/server/services/mind-stats";
import { pickbotStats } from "@/server/services/pickbot-stats";
import { tasteByGroup } from "@/server/services/taste-profiles";
import { ABOUT_QUESTIONS } from "@/lib/about";
import { QUESTION_LABELS, Rows, Section, ShowMore, makeListHref, pct, usd, type TabProps } from "../ui";

/** How each product feature is used: Pickbot, about-you cards, "What's on your mind", taste profiles. */
export async function FeaturesTab({ days, view }: TabProps) {
  const listHref = makeListHref(days, view);
  const [pk, ab, md, taste] = await Promise.all([pickbotStats(view, days), aboutStats(view, days), mindStats(view, days), tasteByGroup()]);
  return (
    <>
      <Section
        title="Pickbot"
        note={`Ask tab (docs/plans/pickbot-prd.html). ${pk.open ? "Open to every signed-in person" : "Admins only (Config pickbotOpen = 0)"}; answers by ${pk.model}; ${pk.holdoutPct}% of accounts never get it. People = distinct people who did each step in the window.`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link href={listHref("askers")} className="card block p-3 transition hover:ring-1 hover:ring-accent">
            <div className="text-xs text-zinc-500">People who asked ›</div>
            <div className="text-2xl font-medium">{pk.usage.askers}</div>
          </Link>
          <div className="card p-3">
            <div className="text-xs text-zinc-500">Questions (not follow-ups)</div>
            <div className="text-2xl font-medium">{pk.usage.questions}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-zinc-500">Questions per asker</div>
            <div className="text-2xl font-medium">{pk.usage.askers ? (pk.usage.questions / pk.usage.askers).toFixed(1) : "—"}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs text-zinc-500">Asked again on another day</div>
            <div className="text-2xl font-medium">{pct(pk.usage.repeat, pk.usage.askers)}</div>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Got an answer: {pk.usage.answeredPeople} of {pk.usage.askers} askers ({pct(pk.usage.answeredPeople, pk.usage.askers)}); the rest stopped at the profile cards or
          the question was off-topic. Questions are private: the Brain shows topics and counts, never the words.
        </p>
        <Rows
          head={["Day", "Askers", "Questions", "Follow-ups", "Answers", "Tailored", "👍 / 👎", "Crowd posts", "Results back", "AI cost"]}
          rows={pk.daily.map((d) => [
            d.day,
            d.askers ? (
              <Link key="a" href={listHref("askers", d.day)} className="underline decoration-ink/20 underline-offset-2 hover:decoration-accent">
                {d.askers}
              </Link>
            ) : (
              0
            ),
            d.questions,
            d.followups,
            d.answers,
            d.tailored,
            `${d.up} / ${d.down}`,
            d.crowd,
            d.results,
            usd(d.cost, 2),
          ])}
        />
        <ShowMore label="Topics, funnel, cost and ratings">
        <Rows
          head={["What people ask about", "Kind", "Questions", "People"]}
          rows={pk.themes.map((t) => [t.theme.replaceAll("_", " "), t.scope.replace("_", "-"), t.questions, t.people])}
        />
        <Rows head={["Step", "People", "Times"]} rows={pk.funnel.map((f) => [f.label, f.people, f.events])} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(
            [
              ["Answers", pk.totalAnswers],
              ["AI cost", usd(pk.totalCost, 2)],
              ["Cost per answer", pk.totalAnswers ? usd(pk.totalCost / pk.totalAnswers, 3) : "—"],
              [
                "Took the better-answer offer",
                pct(pk.choice.retailor ?? 0, (pk.choice.retailor ?? 0) + (pk.funnel.find((f) => f.name === "pickbot_battles_stopped")?.events ?? 0)),
              ],
              ["👍 rate", pct(pk.ratings.reduce((t, r) => t + r.up, 0), pk.ratings.reduce((t, r) => t + r.up + r.down, 0))],
              ["Crowd agreed with Pickbot", pct(pk.agree.yes, pk.agree.yes + pk.agree.no)],
            ] as [string, React.ReactNode][]
          ).map(([k, val]) => (
            <div key={k} className="card p-3">
              <div className="text-xs text-zinc-500">{k}</div>
              <div className="text-xl font-medium">{val}</div>
            </div>
          ))}
        </div>
        <Rows
          head={["Model", "Answer type", "Answers", "Cost each", "Avg seconds"]}
          rows={pk.answers.map((a) => [a.model, a.kind, a.n, usd(a.costPer, 3), a.latencyS.toFixed(1)])}
        />
        <Rows head={["Model", "👍", "👎", "👍 rate"]} rows={pk.ratings.map((r) => [r.model, r.up, r.down, pct(r.up, r.up + r.down)])} />
        </ShowMore>
      </Section>

      <Section
        title="About-you cards"
        note={`One-tap questions in the Vote deck, no account needed: sex after vote 2, age 4, relationship 7, kids 9, education 11, home 13, race/ethnicity 16, party 19 (race and party have "Prefer not to say", which counts as answered); with an account, work 35. Numbers in Config. ZIP is no longer asked (since cards v2): it comes from the IP. ${ab.holdoutPct}% of people never see a card, so comparing them with everyone else shows what cards cost or add.`}
      >
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-xl bg-surface p-3">
            <div className="text-xs text-zinc-500">Card answers per visitor who sees cards (this window)</div>
            <div className="text-2xl tabular-nums">
              {ab.arms.cards.visitors ? (ab.questions.reduce((t, q) => t + q.answered, 0) / ab.arms.cards.visitors).toFixed(2) : "—"}
            </div>
            <div className="text-xs text-zinc-500">How many demographics we learn per visitor, on top of what the IP and phone give us.</div>
          </div>
        </div>
        <Rows
          head={["Question", "Shown", "Answered", "Skipped", "Answer rate"]}
          rows={ab.questions
            .filter((r) => r.shown > 0 || ABOUT_QUESTIONS[r.id].inDeck)
            .map((r) => [QUESTION_LABELS[r.id] ?? r.id, r.shown, r.answered, r.skipped, pct(r.answered, r.shown)])}
        />
      </Section>

      <Section
        title="What’s on your mind this week?"
        note={`One-tap deck card ${md.on ? "after vote 3 (Config mindAt), again after a week" : "(off: Config mindAt = 0)"}; the topic picked steers the next battles. "Other" lets people type their own answer, listed below (the typed words steer battles too). Signed-out people get the "personality map" sign-up card 8 votes after picking. ${md.holdoutPct}% of people never see the card.`}
      >
        <p className="text-sm">
          Shown {md.shown} · answered {md.answered} ({pct(md.answered, md.shown)}) · skipped {md.skipped} · sign-up nudges {md.nudges}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Rows head={["Topic", "Picked", "Share"]} rows={md.topics.map((t) => [t.label, t.n, pct(t.n, md.answered)])} />
          <Rows head={["Typed after “Other”", "Times", "Last"]} rows={md.typed.map((t) => [t.text, t.n, t.last.slice(5, 16)])} />
        </div>
      </Section>

      <Section collapsed
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
    </>
  );
}
