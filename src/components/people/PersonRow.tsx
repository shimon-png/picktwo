import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { ExpertBadge } from "@/components/ui/ExpertBadge";
import { FollowButton } from "@/components/layout/FollowButton";
import { isFriend, type PersonRow as Person } from "@/server/services/social";

/** One person in a list: tap the row for their profile; Follow / Follow back on the right (signed-in, not yourself). */
export function PersonRow({
  p,
  sub,
  detail,
  rank,
  viewerId,
  extra,
}: {
  p: Person;
  sub?: React.ReactNode;
  /** A line of its own under the handle (not truncated together with it), e.g. a taste match. */
  detail?: React.ReactNode;
  rank?: number;
  viewerId: string | null;
  /** Extra controls on the right, before Follow (e.g. a Message button). Needs `relative z-10` to sit above the row link. */
  extra?: React.ReactNode;
}) {
  const button = !!viewerId && viewerId !== p.id;
  // The button already says "Friends" / "Follow back", so the tag only shows where there's no button.
  const label = button ? null : isFriend(p) ? "Friends" : p.followsMe ? "Follows you" : null;
  return (
    <div className="card relative flex items-center gap-3 p-3">
      {rank !== undefined && <span className="w-5 shrink-0 text-center text-sm tabular-nums text-zinc-500">{rank}</span>}
      <Avatar name={p.name || p.handle} seed={p.handle} src={p.image} size={40} className="text-base" />
      <div className="min-w-0 flex-1">
        <Link href={`/u/${p.handle}`} className="flex items-center gap-1 truncate font-medium after:absolute after:inset-0 after:content-['']">
          <span className="truncate">{p.name || `@${p.handle}`}</span>
          <ExpertBadge tier={p.tier} />
        </Link>
        <div className="truncate text-xs text-zinc-500">
          @{p.handle}
          {label && <span className="ml-1.5 rounded-full bg-a-soft px-1.5 py-px text-[11px] text-a">{label}</span>}
          {sub && <> · {sub}</>}
        </div>
        {detail && <div className="mt-0.5 text-xs text-zinc-500">{detail}</div>}
      </div>
      {extra}
      {button && <FollowButton userId={p.id} initial={p.iFollow} followsMe={p.followsMe} small />}
    </div>
  );
}
