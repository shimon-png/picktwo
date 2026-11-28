import { brainScope, visitsBySource } from "@/server/services/brain";
import { signupSources } from "@/server/services/acquisition";
import { unitEconomicsStats } from "@/server/services/unit-economics";
import { money } from "@/server/services/unit-economics-rules";
import { passiveStats, type GroupRow } from "@/server/services/passive-stats";
import { nyDayOf } from "@/server/services/brain-top-rules";
import { LoadZipIncome } from "@/components/admin/AdminActions";
import { Num, Rows, Section, makeListHref, pct, ueFixedLine, ueNote, ueTiles, type TabProps } from "../ui";

/** Where people come from and what they're worth: sources, sign-ups by source, unit economics, who visitors are. */
export async function GrowthTab({ days, view }: TabProps) {
  const listHref = makeListHref(days, view);
  const scope = await brainScope(view, days);
  const [visitSources, acq, ue, ps] = await Promise.all([visitsBySource(scope), signupSources(Math.max(days, 30), view), unitEconomicsStats(view), passiveStats(view, days)]);
  const s = { visitSources };
  const todayDay = nyDayOf(new Date());
  const yesterdayDay = nyDayOf(new Date(Date.now() - 86400_000));
  return (
    <>
      <Section
        title="Visits by source"
        note="Each visit's own tags: an X ad click (twclid) or utm_source=x/twitter is the X campaign, a t.co / x.com referrer is X organic. Visits add up to the Visits tile; a person who came two ways counts under both. Top tags show the utm_campaign for ad visits. Tip: put utm_source and utm_campaign on every campaign link, because apps often hide the referrer."
      >
        <Rows
          head={["Source", "People today", "People yesterday", "People", "Visits", "Top tags"]}
          rows={s.visitSources.map((r) => [
            r.label,
            <Num key="t" n={r.today} href={listHref("visitors", todayDay, { source: r.source })} />,
            <Num key="y" n={r.yesterday} href={listHref("visitors", yesterdayDay, { source: r.source })} />,
            <Num key="p" n={r.visitors} href={listHref("visitors", undefined, { source: r.source })} />,
            <Num key="v" n={r.visits} href={listHref("visitors", undefined, { source: r.source })} />,
            <span key="tags" className="text-xs text-zinc-500">{r.detail || "—"}</span>,
          ])}
        />
      </Section>

      <Section
        title={`Sign-ups by source · last ${acq.days} days${view === "clean" ? " (from the clean start date)" : ""}`}
        note={`Where each new account first came from (their first visit, incl. visits before signing up). X campaign = an X ad click (twclid) or utm_source=x/twitter; X organic = a link from t.co / x.com. Engaged = voted on ${acq.minVoteDays}+ different days, or posted a battle, within ${acq.windowDays} days of signing up. "Engaged (full ${acq.windowDays}d)" only counts people who signed up at least ${acq.windowDays} days ago, so sources are compared fairly. The X pixel fires a sign-up conversion for every new account.`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ["Sign-ups", acq.total.signups],
              ["Engaged so far", `${acq.total.engaged} (${pct(acq.total.engaged, acq.total.signups)})`],
              [`Engaged users (all, 30d)`, acq.overall.engaged30],
              ["Active voters (7d)", acq.overall.active7],
              ["Accounts (all time)", acq.overall.accounts],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface p-2.5">
              <div className="text-xs text-zinc-500">{k}</div>
              <div className="text-xl font-medium">{v}</div>
            </div>
          ))}
        </div>
        <Rows
          head={["Source", "Sign-ups", "Share", "Engaged", "Engaged %", `Engaged (full ${acq.windowDays}d)`, "Avg votes", "Posted", "Active 7d"]}
          rows={acq.rows.map((r) => [
            <span key={r.source} className={r.source === "x_campaign" ? "font-medium" : undefined}>{r.label}</span>,
            r.signups,
            pct(r.signups, acq.total.signups),
            r.engaged,
            pct(r.engaged, r.signups),
            r.matured ? `${pct(r.engagedMatured, r.matured)} of ${r.matured}` : "—",
            r.avgVotes.toFixed(1),
            `${Math.round(r.postedPct * 100)}%`,
            r.active7,
          ])}
        />
      </Section>

      <Section id="unit-economics" title={`Unit economics: what a visitor is worth · since ${ue.from}`} note={ueNote(ue, view)}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {ueTiles(ue).map(([label, value, sub], i) => (
            <div key={label} className={`rounded-xl p-3 ${i === 0 ? (ue.overall.breakEven > 0 ? "bg-green-soft" : "bg-b-soft") : "bg-surface"}`}>
              <div className="text-xs text-zinc-500">{label}</div>
              <div className={`text-lg tabular-nums ${i === 0 ? (ue.overall.breakEven > 0 ? "text-green" : "text-b") : ""}`}>{value}</div>
              <div className="text-[11px] text-zinc-500">{sub}</div>
            </div>
          ))}
        </div>
        <Rows
          head={["First came from", "Visitors", "Votes per visitor", "Visits per visitor", "Sign-up rate", "Worth per visitor", "Break-even per visitor", "Per 1,000 visitors"]}
          rows={[
            { label: <b key="all">Everyone</b>, u: ue.overall },
            ...ue.sources.map((r) => ({ label: r.visitors < 30 ? `${r.label} (few)` : r.label, u: r })),
          ].map(({ label, u }) => [
            label,
            u.visitors,
            u.votesPerVisitor.toFixed(1),
            u.visitsPerVisitor.toFixed(2),
            `${(100 * u.signupRate).toFixed(1)}%`,
            money(u.revenue.total),
            <b key="b" className={u.breakEven > 0 ? "text-green" : "text-b"}>
              {money(u.breakEven)}
            </b>,
            money(u.breakEven * 1000),
          ])}
        />
        <p className="text-xs text-zinc-500">
          What moves it (everyone): sign-up rate ×2 → {money(ue.whatIf.doubleSignupRate)}; one more visit per person → {money(ue.whatIf.oneMoreVisit)}; a
          signed-up user worth 3× → {money(ue.whatIf.signupValueX3)}. Compare with what an ad click costs on X or Meta (about $0.30–$2): break-even above
          that means paid ads pay for themselves. {ueFixedLine(ue)}
        </p>
        <h3 className="pt-2 font-sans text-sm font-medium">By ad campaign</h3>
        {ue.campaigns.length === 0 ? (
          <p className="text-xs text-zinc-500">No ad visits yet. Tag each campaign link, e.g. ?utm_source=x&amp;utm_campaign=whos_right.</p>
        ) : (
          <Rows
            head={["Campaign (utm_campaign)", "Source", "Landing page", "Visitors", "Votes per visitor", "Sign-up rate", "Came back another day", "Break-even per visitor"]}
            rows={ue.campaigns.map((c) => [
              c.visitors < 30 ? `${c.campaign} (few)` : c.campaign,
              <span key="s" className="text-xs text-zinc-500">{c.label}</span>,
              <span key="l" className="text-xs text-zinc-500">{c.landing || "—"}</span>,
              c.visitors,
              c.votesPerVisitor.toFixed(1),
              `${(100 * c.signupRate).toFixed(1)}%`,
              `${Math.round(100 * c.cameBack)}%`,
              <b key="b" className={c.breakEven > 0 ? "text-green" : "text-b"}>
                {money(c.breakEven)}
              </b>,
            ])}
          />
        )}
        <p className="text-xs text-zinc-500">
          Each person counts under the campaign of their first visit (an ad click or utm tag), with the page that visit landed on. Came back = visited on 2+
          different New York days. Compare break-even with that campaign&apos;s cost per click in X Ads: break-even is the most a visitor can cost, so higher is
          better. Under 30 visitors the numbers swing a lot.
        </p>
      </Section>

      <Section collapsed
        title="Who visitors are (no questions asked)"
        note={`People who visited in this window, from signals every browser sends: state from the IP address (Vercel's geolocation, metro-level), iPhone vs Android, phone price tier (iPhone screen size; Android model), the app they opened us in, and an income band estimated from their ZIP area's Census median income (typed ZIP, else the IP guess) nudged by phone tier. Estimates for groups, never shown to anyone. Collected from Nov 25; older visitors show as unknown.`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["State (IP)", ps.region.slice(0, 12)],
              ["Platform", ps.platform],
              ["Phone tier", ps.tier],
              ["Opened in", ps.inApp],
              ["Est. income band", ps.income],
            ] as [string, GroupRow[]][]
          ).map(([label, rows]) => (
            <div key={label}>
              <Rows
                head={[label, "People", "Voted", "Signed up"]}
                rows={rows.map((r) => [r.key, r.visitors, `${r.voted} (${pct(r.voted, r.visitors)})`, `${r.signedUp} (${pct(r.signedUp, r.visitors)})`])}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{ps.zipIncomeRows ? `Census income loaded for ${ps.zipIncomeRows.toLocaleString()} ZIP areas.` : "Census income isn't loaded yet (the daily job loads it; or tap the button)."}</span>
          <LoadZipIncome rows={ps.zipIncomeRows} />
        </div>
      </Section>
    </>
  );
}
