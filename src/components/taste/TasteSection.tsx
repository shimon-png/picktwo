import Link from "next/link";
import type { TasteProfile } from "@/server/services/taste-profile";
import { TasteWheel } from "./TasteWheel";
import { ShareTaste } from "./ShareTaste";

/** "Your taste" on You: the wheel, the type name and two stats; fills in as they vote. */
export function TasteSection({ t }: { t: TasteProfile }) {
  const locked = t.axes.length === 0;
  const full = t.stage === 2;
  const learning = locked && t.votes >= t.firstAt;
  return (
    <section className="card space-y-3 px-4 py-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[22px]">Your taste</h2>
        {!locked && (
          <Link href="/you/taste" className="text-[13px] text-accent">
            {full ? "See all six →" : "Details →"}
          </Link>
        )}
      </div>
      {locked && !learning ? (
        <p className="text-sm text-zinc-600">
          Vote on {t.firstAt - t.votes} more battle{t.firstAt - t.votes === 1 ? "" : "s"} to see your first traits. All six unlock at {t.fullAt} votes.
        </p>
      ) : locked ? (
        <p className="text-sm text-zinc-600">
          Still learning you. A trait shows once {t.axisMin} of your battles have tested it, so keep voting: the deck is sending you battles that test {t.missing.slice(0, 3).join(", ").toLowerCase()} next.
        </p>
      ) : (
        <>
          <p className="display text-[26px] leading-tight text-cta">{t.name ?? `${t.axes.length} of 6 traits so far`}</p>
          <div className="flex justify-center text-ink">
            <TasteWheel axes={t.axes} size={230} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[12px] bg-surface px-3 py-2">
              <b className="block font-display text-[19px] tabular-nums">{t.likeYou ? `${t.likeYou.agree}%` : "—"}</b>
              <span className="text-[12px] text-zinc-600">{t.likeYou ? `agree with ${t.likeYou.label.toLowerCase()}` : t.canCompare ? "agree with people like you (not enough of them have voted with you yet)" : "agree with people like you (add your sex and age in Settings)"}</span>
            </div>
            <div className="rounded-[12px] bg-surface px-3 py-2">
              <b className="block font-display text-[19px] tabular-nums">
                {t.against} of {t.settled}
              </b>
              <span className="text-[12px] text-zinc-600">picks against the crowd</span>
            </div>
          </div>
          {!full && (
            <p className="text-[13px] text-zinc-500">
              Still learning: {t.missing.join(", ").toLowerCase() || "nothing"}. Your type unlocks when all six are measured{t.votes < t.fullAt ? ` and you've voted on ${t.fullAt} battles (${t.fullAt - t.votes} to go)` : ""}.
            </p>
          )}
          {full && <ShareTaste />}
        </>
      )}
    </section>
  );
}
