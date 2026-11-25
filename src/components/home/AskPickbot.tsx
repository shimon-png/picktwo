import Link from "next/link";
import { ArrowRight, Lock, MessageSquareText, Sparkles, UserRound, Users } from "lucide-react";
import { ResultBars } from "@/components/battle/ResultBars";

/**
 * Homepage explainer for the Ask tab (Pickbot, Shimon Nov 26 2026): a sample chat (labelled Example, built from the
 * same pieces as the real answer card) and the three ideas: ask in your own words, it learns you, the crowd checks it.
 */
export function AskPickbot() {
  const points = [
    [MessageSquareText, "bg-accent-900 text-accent", "Ask in your own words", "Type your choice the way you’d text a friend. Add photos of the options if it helps."],
    [UserRound, "bg-violet-soft text-violet", "It answers for you", "A few one-tap profile questions, then an answer that fits you. Finish the 30-battle personality test and it gets tailored to your taste."],
    [Users, "bg-pink-soft text-pink", "Then the crowd checks it", "Post it anonymously in one tap. Real people like you vote, and the results come back to your chat."],
  ] as const;
  return (
    <section className="px-4 pb-12" aria-labelledby="ask-pickbot">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-violet text-white" aria-hidden>
          <Sparkles className="size-4" />
        </span>
        <h2 id="ask-pickbot" className="text-[22px]">
          Stuck right now? Ask Pickbot.
        </h2>
      </div>
      <p className="mt-1 max-w-xl text-[15px] text-zinc-600">
        Pickbot is crowdpick’s AI for your own decisions. It answers based on who you are and how people like you vote, not with a one-size-fits-all reply.
      </p>

      <div className="mt-5 grid items-start gap-4 sm:grid-cols-2">
        {/* Example chat */}
        <div className="relative space-y-2.5 rounded-[18px] bg-surface p-4" aria-hidden>
          <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 shadow-ring">Example</span>
          <div className="flex justify-end pt-6">
            <div className="max-w-[85%] rounded-[16px] rounded-tr-[4px] bg-a px-3.5 py-2.5 text-[14px] leading-snug text-white">
              Winter wedding next month, outdoor ceremony. The green dress or the burgundy one?
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet text-white">
              <Sparkles className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 space-y-2 rounded-[16px] rounded-tl-[4px] bg-white px-3.5 py-3 shadow-soft">
              <span className="inline-block rounded-full bg-green-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green">Tailored</span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">My pick</p>
                <p className="display text-[22px] leading-tight text-ink">The green one</p>
              </div>
              <p className="text-[13px] leading-snug text-ink/80">
                <b className="text-ink">Why it fits you: </b>you lean romantic and trendy, and you usually pick the standout option for big events. Green also photographs
                well in winter light.
              </p>
              <div className="rounded-[10px] bg-a-soft/60 p-2.5">
                <span className="block text-[12px] font-medium">On 41 similar wedding-guest battles</span>
                <ResultBars side="A" everyone={{ a: 54, b: 46, total: 2310 }} likeYou={{ kind: "score", label: "Women 25–34", a: 68, b: 32, total: 412 }} onPhoto={false} />
              </div>
            </div>
          </div>
        </div>

        {/* The three ideas */}
        <div className="space-y-3">
          {points.map(([Icon, tone, title, line]) => (
            <div key={title} className="flex items-start gap-3.5 rounded-[18px] bg-surface p-4">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <div className="text-[16px] font-medium">{title}</div>
                <p className="mt-0.5 text-[14px] text-zinc-600">{line}</p>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/signin?callbackUrl=/ask" data-track="pickbot_start" className="btn-cta inline-flex items-center gap-2 rounded-full px-5 py-3 text-[15px]">
              Ask Pickbot <ArrowRight className="size-4" aria-hidden />
            </Link>
            <span className="flex items-center gap-1 text-[12px] text-zinc-500">
              <Lock className="size-3" /> Free · your questions stay private
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
