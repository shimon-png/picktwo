import Link from "next/link";
import { Lock } from "lucide-react";
import { ResultBars } from "@/components/battle/ResultBars";
import { TasteWheel } from "@/components/taste/TasteWheel";

/** Sample data only (labelled "Example"): what the about-you cards, the "people like you" bar and the taste profile look like. */
const SAMPLE_WHEEL = [
  { id: "romantic", score: 0.7, crowd: 0.1 },
  { id: "adventurous", score: 0.25, crowd: 0 },
  { id: "spender", score: -0.3, crowd: 0.05 },
  { id: "trendy", score: 0.1, crowd: 0.1 },
  { id: "forgiving", score: -0.2, crowd: 0.15 },
  { id: "direct", score: 0.6, crowd: -0.1 },
];

function Step({ n, title, line, children }: { n: number; title: string; line: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-surface p-4">
      <div className="relative flex min-h-[230px] items-center justify-center overflow-hidden rounded-[14px] bg-white p-3 pt-8 shadow-ring sm:h-[272px] sm:min-h-0">
        <span className="absolute right-2 top-2 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">Example</span>
        {children}
      </div>
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[13px] text-page">{n}</span>
        <div>
          <div className="text-[16px] font-medium">{title}</div>
          <p className="mt-0.5 text-[14px] text-zinc-600">{line}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Homepage explainer (Shimon, Nov 25 2026): how voting builds your profile — one-tap about-you questions, the
 * "people like you" bar, and the taste profile — with sample graphics made from the real components.
 */
export function KnowYourTaste() {
  return (
    <section className="px-4 pb-12" aria-labelledby="know-your-taste">
      <h2 id="know-your-taste" className="text-[22px]">
        Learn your taste. See how people like you vote.
      </h2>
      <p className="mt-1 max-w-xl text-[15px] text-zinc-600">
        Every pick says something about you. Answer a few one-tap questions along the way and crowdpick builds your profile: how people like you
        voted on every battle, and a taste profile that fills in as you play.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Step n={1} title="Tell us a little, one tap at a time" line="A quick question between battles. Skip any of them. Never shown on your profile.">
          <div className="flex w-full max-w-[230px] flex-col gap-1.5" aria-hidden>
            <span className="self-start rounded-full bg-a-soft px-2 py-0.5 font-display text-[9px] font-semibold uppercase tracking-[.1em] text-a">About you · 1 tap</span>
            <span className="display text-[20px] leading-tight">I&apos;m…</span>
            {[
              ["25–34", "bg-a-soft text-a ring-a/35"],
              ["18–24", "bg-b-soft text-b ring-b/35"],
              ["35–44", "bg-green-soft text-green ring-green/35"],
            ].map(([l, c]) => (
              <span key={l} className={`rounded-[10px] py-2 text-center font-display text-[15px] font-semibold ring-1 ${c}`}>
                {l}
              </span>
            ))}
            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
              <Lock className="size-3 text-green" /> Only used in group results
            </span>
          </div>
        </Step>
        <Step n={2} title="See how people like you voted" line="After every pick: everyone, experts, and people your age and sex.">
          <div className="w-full max-w-[240px] rounded-[12px] bg-a-soft/60 p-3" aria-hidden>
            <span className="block text-[13px] font-medium">“It counts”</span>
            <ResultBars
              side="A"
              everyone={{ a: 58, b: 42, total: 1240 }}
              likeYou={{ kind: "score", label: "Women 25–34", a: 71, b: 29, total: 312 }}
              onPhoto={false}
            />
          </div>
        </Step>
        <Step n={3} title="Unlock your taste profile" line="Six traits built from your picks: two at 10 votes, all six at 30. Share it to your story.">
          <div className="flex flex-col items-center text-ink" aria-hidden>
            <span className="display text-[18px] text-cta">Romantic realist</span>
            <TasteWheel axes={SAMPLE_WHEEL} size={190} />
          </div>
        </Step>
      </div>
      <div className="mt-5 flex justify-center">
        <Link href="/vote" data-track="taste_start" className="btn-cta rounded-full px-8 py-3 text-base shadow-card">
          Start voting, it&apos;s free
        </Link>
      </div>
    </section>
  );
}
