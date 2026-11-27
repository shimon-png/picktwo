import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/viewer";
import { tasteProfileFor } from "@/server/services/taste-profile";
import { TasteWheel } from "@/components/taste/TasteWheel";
import { ShareTaste } from "@/components/taste/ShareTaste";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your taste" };

/** Taste profile detail (About-you plan §4): each trait as a slider between its two poles, why, and the battles behind it. */
export default async function TastePage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/signin?callbackUrl=/you/taste");
  const t = await tasteProfileFor(viewer, { examples: true });
  if (!t) redirect("/you");
  return (
    <div className="space-y-5">
      <Link href="/you" className="text-[13px] text-accent">
        ← You
      </Link>
      <header className="space-y-1">
        <h1 className="text-[28px]">Your taste</h1>
        <p className="display text-[26px] leading-tight text-cta">{t.name ?? (t.axes.length ? `${t.axes.length} of 6 traits so far` : "Still learning you")}</p>
        <p className="text-sm text-zinc-600">
          Built from your picks on {t.tagged} battle{t.tagged === 1 ? "" : "s"}. The dashed ring is the average voter. Only you see this.
        </p>
      </header>
      {t.axes.length > 0 && (
        <div className="flex justify-center text-ink">
          <TasteWheel axes={t.axes} size={260} />
        </div>
      )}
      <ul className="space-y-3">
        {t.axes.map((a) => (
          <li key={a.id} className="card space-y-2 px-4 py-3">
            <div className="flex items-center gap-2 text-[12px] text-zinc-600">
              <span className="w-24">{a.left}</span>
              <span className="relative h-1 flex-1 rounded-full bg-surface" aria-label={`${a.left} ${Math.round((a.score + 1) * 50)}%`}>
                <span className="absolute left-1/2 top-[-3px] h-2.5 w-px bg-zinc-500" aria-hidden />
                <span className="absolute top-[-4px] size-3 -translate-x-1/2 rounded-full bg-cta shadow-[0_0_8px_rgba(198,255,61,.6)]" style={{ left: `${50 - a.score * 50}%` }} aria-hidden />
              </span>
              <span className="w-24 text-right">{a.right}</span>
            </div>
            <p className="text-[13px] text-zinc-600">{a.why}</p>
            {a.examples.length > 0 && (
              <ul className="space-y-1 text-[13px]">
                {(a.examples as { slug: string; title: string; pole: string }[]).map((x) => (
                  <li key={x.slug} className="flex gap-2">
                    <span className="shrink-0 text-zinc-500">{x.pole}:</span>
                    <Link href={`/b/${x.slug}`} className="line-clamp-1 underline-offset-2 hover:underline">
                      {x.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {t.stage < 2 && (
        <p className="text-sm text-zinc-600">
          A trait shows once {t.axisMin} of your battles have tested it. Still learning: {t.missing.join(", ").toLowerCase()}. Your type unlocks when all six are measured
          {t.votes < t.fullAt ? ` and you've voted on ${t.fullAt} battles (you have ${t.votes})` : ""}. Keep voting: the deck sends you battles that test the missing ones.
        </p>
      )}
      <Link href="/people-like-you" className="card block px-4 py-3 text-sm">
        <b className="block">Your taste twins</b>
        <span className="text-zinc-600">People who agree with you most often →</span>
      </Link>
      {t.axes.length >= 6 && <ShareTaste />}
    </div>
  );
}
