import Link from "next/link";
import { Search, X } from "lucide-react";
import { getViewer } from "@/server/viewer";
import { ACTIVE_DAYS, cleanQuery, searchBattles, searchPeople, topBattles, topExperts, topVoters, type DiscoverCard } from "@/server/services/discover";
import type { PersonRow as Person } from "@/server/services/social";
import { BattleCardRow } from "@/components/battle/BattleCardRow";
import { PersonRow } from "@/components/people/PersonRow";
import { MessageButton } from "@/components/messages/MessageButton";
import { tasteTwins } from "@/server/services/matches";
import { ExpandList } from "@/components/ui/ExpandList";

export const metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const q = cleanQuery(raw);
  const viewer = await getViewer();
  const viewerId = viewer.user?.id ?? null;

  return (
    <div className="space-y-7">
      <header className="space-y-3 pt-1">
        <h1 className="text-[32px] leading-none">Discover</h1>
        <form action="/discover" role="search" className="relative">
          <label htmlFor="discover-q" className="sr-only">
            Search battles and people
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            id="discover-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search battles or people"
            className="input !rounded-full !py-3 !pl-10 !pr-10"
            enterKeyHint="search"
            autoComplete="off"
          />
          {q && (
            <Link href="/discover" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-500 hover:bg-surface">
              <X className="size-4" />
            </Link>
          )}
        </form>
      </header>
      {q ? <Results q={q} viewer={viewer} viewerId={viewerId} /> : <Boards viewer={viewer} viewerId={viewerId} />}
    </div>
  );
}

type Viewer = Awaited<ReturnType<typeof getViewer>>;

async function Results({ q, viewer, viewerId }: { q: string; viewer: Viewer; viewerId: string | null }) {
  const [people, found] = await Promise.all([searchPeople(viewer, q), searchBattles(viewer, q)]);
  if (!people.length && !found.length)
    return <p className="card p-5 text-center text-sm text-zinc-600">Nothing matches “{q}”. Try another word, or a username.</p>;
  return (
    <>
      {people.length > 0 && (
        <Section title="People">
          <PeopleList people={people} viewerId={viewerId} />
        </Section>
      )}
      {found.length > 0 && (
        <Section title="Battles">
          <BattleList cards={found} src="search" />
        </Section>
      )}
    </>
  );
}

async function Boards({ viewer, viewerId }: { viewer: Viewer; viewerId: string | null }) {
  const [battles, experts, voters, twins] = await Promise.all([
    topBattles(viewer),
    topExperts(viewer),
    topVoters(viewer),
    viewer.user ? tasteTwins(viewer.user, 5) : Promise.resolve([]),
  ]);
  return (
    <>
      {twins.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[22px]">People who vote like you</h2>
            <Link href="/people-like-you" className="text-sm text-accent">
              See all
            </Link>
          </div>
          <p className="mb-2.5 text-[13px] text-zinc-500">How often you picked the same side on battles you both voted on.</p>
          <div className="space-y-2">
            {twins.map((p, i) => (
              <PersonRow
                key={p.id}
                p={p}
                rank={i + 1}
                viewerId={viewerId}
                detail={`${p.pct}% agree · ${p.shared} in common`}
                extra={p.iFollow ? <MessageButton handle={p.handle} small /> : undefined}
              />
            ))}
          </div>
        </section>
      )}
      <Section title="Top battles" sub="Live battles with the most votes. Tap one to vote.">
        <BattleList cards={battles} src="discover" empty="No live battles right now." />
      </Section>
      <Section title="Top experts" sub="Most correct picks: they voted for what the poster ended up choosing.">
        <PeopleList
          people={experts}
          viewerId={viewerId}
          ranked
          sub={(p) => `${p.correctPicks} correct pick${p.correctPicks === 1 ? "" : "s"}`}
          empty="No experts yet. Vote, and when posters report back, correct picks count here."
        />
      </Section>
      <Section title="Most active voters" sub={`Most votes in the last ${ACTIVE_DAYS} days.`}>
        <PeopleList people={voters} viewerId={viewerId} ranked sub={(p) => `${p.stat ?? 0} vote${p.stat === 1 ? "" : "s"}`} empty="No votes yet this month." />
      </Section>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[22px]">{title}</h2>
      {sub && <p className="mb-2.5 text-[13px] text-zinc-500">{sub}</p>}
      {!sub && <div className="mb-2.5" />}
      {children}
    </section>
  );
}

function BattleList({ cards, src, empty }: { cards: DiscoverCard[]; src: string; empty?: string }) {
  return (
    <ExpandList
      searchPlaceholder="Search these battles"
      empty={empty ? <p className="text-sm text-zinc-500">{empty}</p> : undefined}
      items={cards.map((b) => ({
        key: b.id,
        text: `${b.title} ${b.context ?? ""} ${b.labelA} ${b.labelB} ${b.authorHandle ?? ""}`,
        node: <BattleCardRow b={b} src={src} hideResults={b.hideResults} voted={b.voted} />,
      }))}
    />
  );
}

function PeopleList({
  people,
  viewerId,
  ranked,
  sub,
  empty,
}: {
  people: Person[];
  viewerId: string | null;
  ranked?: boolean;
  sub?: (p: Person) => string;
  empty?: string;
}) {
  return (
    <ExpandList
      searchPlaceholder="Search people"
      empty={empty ? <p className="text-sm text-zinc-500">{empty}</p> : undefined}
      items={people.map((p, i) => ({
        key: p.id,
        text: `${p.name ?? ""} ${p.handle}`,
        node: <PersonRow p={p} viewerId={viewerId} rank={ranked ? i + 1 : undefined} sub={sub?.(p)} />,
      }))}
    />
  );
}
