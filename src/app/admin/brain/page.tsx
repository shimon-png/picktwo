import { Suspense } from "react";
import Link from "next/link";
import { brainScope, type BrainView } from "@/server/services/brain";
import { funnelNumbers, topNumbers } from "@/server/services/brain-top";
import { nyDate, makeListHref } from "./ui";
import { FunnelStrip, KpiTiles } from "./top";
import { LiveTests, loadTests } from "./tests";
import { TrendsTab } from "./tabs/trends";
import { GrowthTab } from "./tabs/growth";
import { DeckTab } from "./tabs/deck";
import { ExperimentsTab } from "./tabs/experiments";
import { FeaturesTab } from "./tabs/features";
import { PeopleTab } from "./tabs/people";
import { ChecksTab } from "./tabs/checks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brain" };

/**
 * /admin/brain (docs/brain/), reorganised Nov 28 2026 (Alex: "defragment the Brain"; plan doc "Brain dashboard cleanup
 * plan"). One top screen that answers "are we growing and are people sticking?" (six headline numbers with 14-day
 * sparklines, the funnel strip, live experiments), then tabs. Each tab loads only its own numbers, so a page load runs
 * the top screen plus one tab. Nothing was deleted: secondary tables sit behind "Show more" / collapsed cards.
 */
const TABS = [
  { key: "trends", label: "Trends" },
  { key: "growth", label: "Growth" },
  { key: "deck", label: "Deck" },
  { key: "experiments", label: "Experiments" },
  { key: "features", label: "Features" },
  { key: "people", label: "People" },
  { key: "checks", label: "Checks" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function BrainPage({ searchParams }: { searchParams: Promise<{ days?: string; view?: string; tab?: string; metric?: string }> }) {
  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const view: BrainView = sp.view === "all" ? "all" : "clean";
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "trends";
  const href = (o: { days?: number; view?: BrainView; tab?: Tab }) =>
    `/admin/brain?tab=${o.tab ?? tab}&days=${o.days ?? days}${(o.view ?? view) === "all" ? "&view=all" : ""}`;
  const props = { days, view };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[22px]">Brain</h2>
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

      <Suspense fallback={<TopSkeleton />}>
        <TopScreen days={days} view={view} />
      </Suspense>

      {/* A div, not <nav>: the Arcade theme turns nav a[aria-current] text lime, which vanishes on the lime chip-on. */}
      <div role="tablist" className="sticky top-0 z-20 -mx-1 flex gap-1.5 overflow-x-auto bg-page/90 px-1 py-2 backdrop-blur" aria-label="Brain sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href({ tab: t.key })}
            scroll={false}
            className={`chip shrink-0 !py-1.5 text-sm ${t.key === tab ? "chip-on" : ""}`}
            role="tab"
            aria-selected={t.key === tab}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Suspense key={`${tab}-${days}-${view}-${sp.metric ?? ""}`} fallback={<p className="card p-4 text-sm text-zinc-500">Loading {TABS.find((t) => t.key === tab)!.label}…</p>}>
        <div className="space-y-5">
          {tab === "trends" && <TrendsTab {...props} metric={sp.metric} />}
          {tab === "growth" && <GrowthTab {...props} />}
          {tab === "deck" && <DeckTab {...props} />}
          {tab === "experiments" && <ExperimentsTab {...props} />}
          {tab === "features" && <FeaturesTab {...props} />}
          {tab === "people" && <PeopleTab {...props} />}
          {tab === "checks" && <ChecksTab {...props} />}
        </div>
      </Suspense>
    </div>
  );
}

async function TopScreen({ days, view }: { days: number; view: BrainView }) {
  const [top, funnel, tests, cleanFrom] = await Promise.all([topNumbers(view), funnelNumbers(view, days), loadTests(view, days), cleanStart(view)]);
  const listHref = makeListHref(days, view);
  const journeyHref = (step: string) => `/admin/journey?days=${days}${view === "all" ? "&view=all" : ""}${step ? `&step=${encodeURIComponent(step)}` : ""}#people`;
  const testHref = (id: string) => `/admin/brain?tab=experiments&days=${days}${view === "all" ? "&view=all" : ""}${id ? `#test-${id}` : ""}`;
  return (
    <>
      <KpiTiles top={top} growthHref={`/admin/brain?tab=growth&days=${days}${view === "all" ? "&view=all" : ""}#unit-economics`} listHref={(k, day) => makeListHref(1, view)(k, day)} journeyHref={(s) => `/admin/journey?days=1${view === "all" ? "&view=all" : ""}&step=${encodeURIComponent(s)}#people`} />
      <p className="text-[11px] text-zinc-500">
        Headline tiles: today so far (New York time) against the 7 days before, whatever window is picked. {view === "clean" ? `Clean view: real people only, from ${cleanFrom}; seed votes, made-up accounts, admins and bots left out.` : "All data: includes seed votes and admin test activity (bots still left out)."} Number checks are on the Checks tab.
      </p>
      <FunnelStrip steps={funnel} days={days} journeyHref={journeyHref} gateHref={listHref("gates")} />
      <LiveTests tests={tests.summaries} href={testHref} />
    </>
  );
}

async function cleanStart(view: BrainView) {
  if (view === "all") return "";
  const s = await brainScope("clean", 1);
  return s.cleanFrom ? nyDate(s.cleanFrom) : "";
}

function TopSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card h-[150px] animate-pulse p-4" />
      ))}
    </div>
  );
}
