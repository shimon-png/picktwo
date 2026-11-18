"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Zap } from "lucide-react";
import { api, setPP, toast } from "@/lib/client";
import { cn, pct, timeLeft } from "@/lib/utils";
import { AVATAR_TONES, CATEGORIES, TONE_CLASSES, kidAgeLabel, reasonSuggestions } from "@/lib/constants";
import { pointsTier } from "@/server/services/priority";
import type { BattleCard } from "@/server/services/battles";
import { OptionFace } from "./OptionFace";

type Side = "A" | "B";
type VoteRes = { results: { a: number; b: number; total: number }; points: number; ppBalance: number | null };

const HIGHLIGHT_PX = 40;
const VOTE_PX = 90;
const FLY_MS = 280;

export function SwipeDeck({
  initial,
  category,
  signedIn,
  pp: initialPP,
  tiers,
}: {
  initial: BattleCard[];
  category: string | null;
  signedIn: boolean;
  pp: number | null;
  tiers: { highAt: number; topAt: number };
}) {
  const router = useRouter();
  const [queue, setQueue] = useState(initial);
  const [voted, setVoted] = useState<Side | null>(null);
  const [result, setResult] = useState<{ a: number; b: number; total: number } | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [fly, setFly] = useState<-1 | 1 | 0>(0);
  const [dx, setDx] = useState(0);
  const [pp, setPp] = useState(initialPP);
  const [session, setSession] = useState({ votes: 0, points: 0 });
  const shownAt = useRef(Date.now());
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const seen = useRef(new Set(initial.map((i) => i.id)));
  const card = queue[0];
  const peek = queue[1];

  useEffect(() => {
    shownAt.current = Date.now();
  }, [card?.id]);

  // Keep the tier line in sync with balance changes from anywhere (e.g. the reason bonus).
  useEffect(() => {
    const on = (e: Event) => setPp((e as CustomEvent<number>).detail);
    window.addEventListener("pt:pp", on);
    return () => window.removeEventListener("pt:pp", on);
  }, []);

  const loadMore = useCallback(async () => {
    try {
      const r = await api<{ items: BattleCard[] }>(`/api/feed${category ? `?category=${category}` : ""}`);
      const fresh = r.items.filter((i) => !seen.current.has(i.id));
      fresh.forEach((i) => seen.current.add(i.id));
      if (fresh.length) setQueue((q) => [...q, ...fresh]);
    } catch {}
  }, [category]);

  useEffect(() => {
    if (queue.length < 3) loadMore();
  }, [queue.length, loadMore]);

  const advance = useCallback((dir: -1 | 1) => {
    setFly(dir);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setFly(0);
      setDx(0);
      setVoted(null);
      setResult(null);
      setReason(null);
      setWriting(false);
      setDraft("");
    }, FLY_MS);
  }, []);

  async function vote(side: Side) {
    if (!card || voted || fly) return;
    setVoted(side);
    setDx(0);
    const dwellMs = Date.now() - shownAt.current;
    setResult(pct(card.votesA + (side === "A" ? 1 : 0), card.votesB + (side === "B" ? 1 : 0)));
    try {
      const r = await api<VoteRes>(`/api/battles/${card.slug}/vote`, { body: { side, dwellMs, source: "feed" } });
      setResult(r.results);
      setPP(r.ppBalance);
      if (r.ppBalance != null) setPp(r.ppBalance);
      setSession((s) => ({ votes: s.votes + 1, points: s.points + r.points }));
      if (r.points > 0) toast(`+${r.points} for voting`, "pp");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function giveReason(text: string) {
    if (!card || !voted || reason) return;
    const t = text.trim();
    if (!t) return;
    setReason(t);
    setWriting(false);
    try {
      const r = await api<VoteRes>(`/api/battles/${card.slug}/vote`, { body: { side: voted, reason: t, source: "feed" } });
      setPP(r.ppBalance);
      if (r.ppBalance != null) setPp(r.ppBalance);
      if (r.points > 0) {
        setSession((s) => ({ ...s, points: s.points + r.points }));
        toast(`+${r.points} for a reason`, "pp");
      }
    } catch (e) {
      setReason(null);
      toast((e as Error).message, "error");
    }
  }

  function skip() {
    if (!card || voted || fly) return;
    api(`/api/battles/${card.slug}/skip`, { method: "POST" }).catch(() => {});
    advance(-1);
  }

  function next() {
    if (!voted || fly) return;
    advance(voted === "A" ? -1 : 1);
  }

  // Keyboard: ← A, → B, ↓ skip, Enter next
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") vote("A");
      else if (e.key === "ArrowRight") vote("B");
      else if (e.key === "ArrowDown") skip();
      else if (e.key === "Enter" && voted) next();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const tier = pp != null ? pointsTier(pp, tiers.highAt, tiers.topAt) : null;
  const tierLine = tier ? (tier.next ? `${tier.toNext} ⚡ to ${tier.next} priority.` : "Top priority — your battles go first.") : null;

  const header = (
    <div className="sticky top-14 z-20 -mx-4 bg-white/95 px-4 pb-3 backdrop-blur">
      <p className="mb-2.5 text-xs text-zinc-500">
        {tierLine ?? (
          <>
            Votes count without an account.{" "}
            <Link href="/signin?callbackUrl=/vote" className="text-accent">
              Sign in to earn ⚡
            </Link>
          </>
        )}
      </p>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Categories">
        <button
          role="tab"
          aria-selected={!category}
          className={cn("shrink-0 rounded-md px-2.5 py-1 text-[13px]", !category ? TONE_CLASSES.blue.solid : TONE_CLASSES.blue.soft)}
          onClick={() => router.push("/vote")}
        >
          For you
        </button>
        {CATEGORIES.filter((c) => c.id !== "other").map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={category === c.id}
            className={cn("shrink-0 rounded-md px-2.5 py-1 text-[13px]", category === c.id ? TONE_CLASSES[c.tone].solid : TONE_CLASSES[c.tone].soft)}
            onClick={() => router.push(`/vote?category=${c.id}`)}
          >
            {c.short}
          </button>
        ))}
      </div>
    </div>
  );

  if (!card)
    return (
      <div>
        {header}
        <div className="card mt-2 flex flex-col items-center gap-2 px-6 py-12 text-center">
          <h1 className="text-xl">You’re all caught up</h1>
          {signedIn && <p className="text-zinc-600">+{session.points} ⚡ this session.</p>}
          {tierLine && <p className="text-sm text-zinc-500">{tierLine}</p>}
          <Link href="/post" className="btn-primary mt-3">
            Post a battle
          </Link>
        </div>
      </div>
    );

  const handle = card.authorHandle ? `@${card.authorHandle}` : (card.authorName ?? "someone");
  const parentOf = card.authorKidAges[0] ? `parent of a ${kidAgeLabel(card.authorKidAges[0])} y/o` : null;
  const avatarTone = AVATAR_TONES[session.votes % AVATAR_TONES.length];
  const chips = reasonSuggestions(card.categoryId);
  const style: React.CSSProperties = fly
    ? { transform: `translateX(${fly * 460}px) rotate(${fly * 16}deg)`, opacity: 0, transition: `transform ${FLY_MS}ms ease, opacity ${FLY_MS}ms ease` }
    : dx
      ? { transform: `translateX(${dx}px) rotate(${dx / 22}deg)` }
      : { transition: "transform 200ms ease" };

  return (
    <div>
      {header}
      <div className="relative h-[calc(100dvh-14.5rem)] min-h-[440px] md:h-[calc(100dvh-10rem)]">
        {peek && <div aria-hidden className="absolute inset-0 translate-y-2.5 scale-95 rounded-2xl bg-surface opacity-60 shadow-ring" />}
        <article
          key={card.id}
          aria-label={card.title}
          className="animate-pop absolute inset-0 flex touch-pan-y select-none flex-col rounded-2xl bg-surface p-3.5 shadow-ring"
          style={style}
          onPointerDown={(e) => {
            if (voted || fly || (e.target as HTMLElement).closest("[data-nodrag]")) return;
            drag.current = { x: e.clientX, moved: false };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const d = e.clientX - drag.current.x;
            if (!drag.current.moved && Math.abs(d) > 6) {
              drag.current.moved = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }
            if (drag.current.moved) setDx(d);
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            if (!d?.moved) return;
            if (dx <= -VOTE_PX) vote("A");
            else if (dx >= VOTE_PX) vote("B");
            else setDx(0);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDx(0);
          }}
        >
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]", TONE_CLASSES[avatarTone].solid)} aria-hidden>
              {handle.replace(/^@/, "")[0]?.toUpperCase()}
            </span>
            <span className="truncate">
              {handle}
              {parentOf && ` · ${parentOf}`}
            </span>
            <span className="ml-auto shrink-0">{timeLeft(card.deadline)}</span>
          </div>
          <h1 className="mt-2.5 text-[21px] leading-snug">
            <Link href={`/b/${card.slug}?src=feed`} data-nodrag className="hover:underline">
              {card.title}
            </Link>
          </h1>
          {card.context && <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-500">{card.context}</p>}

          <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-2">
            {(["A", "B"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="h-full min-h-0 active:scale-[0.98]"
                aria-label={`Vote for ${s === "A" ? card.labelA : card.labelB}`}
                aria-pressed={voted === s}
                disabled={!!voted}
                onClick={() => {
                  if (drag.current?.moved || dx) return;
                  vote(s);
                }}
              >
                <OptionFace
                  side={s}
                  label={s === "A" ? card.labelA : card.labelB}
                  image={s === "A" ? card.imageA : card.imageB}
                  percent={result ? (s === "A" ? result.a : result.b) : null}
                  ring={voted === s}
                  hot={!voted && ((s === "A" && dx <= -HIGHLIGHT_PX) || (s === "B" && dx >= HIGHLIGHT_PX))}
                  big
                />
              </button>
            ))}
          </div>

          {voted ? (
            <div className="mt-3 space-y-2.5" data-nodrag>
              {signedIn ? (
                <>
                  <p className="flex items-center gap-1 text-xs text-zinc-500">
                    Why? optional ·
                    <Zap className="size-3 fill-pp text-pp" aria-hidden /> +1 for a reason
                  </p>
                  {writing ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        giveReason(draft);
                      }}
                    >
                      <input
                        autoFocus
                        className="input !py-1.5 text-sm"
                        placeholder="One line on why…"
                        maxLength={140}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        aria-label="Reason"
                      />
                      <button className="btn-outline !px-3 !py-1.5 text-sm" disabled={!draft.trim()}>
                        Add
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((c) => (
                        <button
                          key={c}
                          type="button"
                          disabled={!!reason}
                          aria-pressed={reason === c}
                          onClick={() => giveReason(c)}
                          className={cn("chip bg-white shadow-ring", reason === c && "chip-on")}
                        >
                          {c}
                        </button>
                      ))}
                      {!reason && (
                        <button type="button" className="chip bg-white text-zinc-500 shadow-ring" onClick={() => setWriting(true)}>
                          Other…
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-zinc-500">
                  Counted.{" "}
                  <Link href="/signin?callbackUrl=/vote" className="text-accent">
                    Sign in
                  </Link>{" "}
                  to earn ⚡ and get your own questions answered first.
                </p>
              )}
              <button type="button" className="btn-primary w-full" onClick={next}>
                Next <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>← A · swipe or tap · B →</span>
              <button type="button" data-nodrag className="btn-ghost !px-2 !py-1 text-[13px] text-ink" onClick={skip}>
                Skip
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
