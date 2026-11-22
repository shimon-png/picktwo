"use client";
import Link from "next/link";
import { ExpertBadge } from "@/components/ui/ExpertBadge";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, setPP, toast } from "@/lib/client";
import { doneIds, markDone, unmarkDone } from "@/lib/seen";
import { SignupGate } from "@/components/auth/SignupGate";
import { cn, pct, timeLeft, titleSizeClass } from "@/lib/utils";
import { AVATAR_TONES, TONE_CLASSES, kidAgeLabel } from "@/lib/constants";
import { pointsTier } from "@/server/services/priority";
import type { BattleCard } from "@/server/services/battles";
import { OptionFace } from "./OptionFace";
import { wink } from "@/components/layout/Logo";
import { RollCard } from "./RollCard";
import { isRollMilestone, ROLL_KEY } from "@/lib/streak";
import { PhotoFlag } from "./PhotoFlag";
import { ResultBars } from "./ResultBars";

type Side = "A" | "B";
const other = (s: Side): Side => (s === "A" ? "B" : "A");
type VoteRes = { results: { a: number; b: number; total: number }; points: number; ppBalance: number | null; guestVotesLeft?: number | null };

/**
 * Two ways to pick (Alex, Nov 21 2026): tap the photo you want, or swipe away the one you don't.
 * Either way the chosen photo grows to fill the card and shows result bars (Everyone, plus
 * Experts once expert votes exist), holds for RESULT_MS, then the next battle comes up by itself.
 */
const AWAY_FRAC = 0.28; // drag past this share of the card width to swipe a photo away…
const FLING_PX_MS = 0.55; // …or flick faster than this
const THROW_MS = 340;
const RESULT_MS = 1500; // how long the picked photo and its scores show before the next battle
const FLY_MS = 280;

/** Short buzz where the browser supports it (Android Chrome; iOS Safari has no web vibration). */
function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

export function SwipeDeck({
  initial,
  signedIn,
  pp: initialPP,
  tiers,
  guestLeft: initialGuestLeft,
  guestLimit,
}: {
  initial: BattleCard[];
  signedIn: boolean;
  pp: number | null;
  tiers: { highAt: number; topAt: number };
  /** Free votes left for a signed-out visitor (null when signed in). */
  guestLeft: number | null;
  guestLimit: number;
}) {
  const [queue, setQueue] = useState(initial);
  const [guestLeft, setGuestLeft] = useState(initialGuestLeft);
  const [voted, setVoted] = useState<Side | null>(null);
  const [result, setResult] = useState<{ a: number; b: number; total: number } | null>(null);
  const [fly, setFly] = useState<-1 | 1 | 0>(0);
  // The grabbed photo and its offset, and the photo swiped off the card (the one NOT picked).
  const [grab, setGrab] = useState<{ side: Side; dx: number; dy: number } | null>(null);
  const [thrown, setThrown] = useState<{ side: Side; dir: -1 | 1 } | null>(null);
  const [pp, setPp] = useState(initialPP);
  const [session, setSession] = useState({ votes: 0, points: 0 });
  // "You're on a roll" card: picks this tab session (survives switching tabs), and the milestone on screen.
  const rollCount = useRef(0);
  const [roll, setRoll] = useState<number | null>(null);
  useEffect(() => {
    try {
      rollCount.current = Number(sessionStorage.getItem(ROLL_KEY)) || 0;
    } catch {}
  }, []);
  const shownAt = useRef(Date.now());
  const drag = useRef<{ side: Side; x: number; y: number; dx: number; moved: boolean; w: number; lx: number; lt: number; v: number; armed: boolean; end: () => void } | null>(null);
  const justDragged = useRef(false);
  const cardRef = useRef<HTMLElement>(null);
  const seen = useRef(new Set(initial.map((i) => i.id)));
  const card = queue[0];
  const peek = queue[1];

  useEffect(() => {
    shownAt.current = Date.now();
  }, [card?.id]);

  // Drop any window listeners from an unfinished drag if the deck unmounts.
  useEffect(() => () => drag.current?.end(), []);

  // Never show a battle this browser already voted on or skipped (e.g. a cached feed after switching tabs).
  useEffect(() => {
    const done = doneIds();
    if (done.size) setQueue((q) => q.filter((i) => !done.has(i.id)));
  }, []);

  // Keep the tier line in sync with balance changes from anywhere (e.g. the reason bonus).
  useEffect(() => {
    const on = (e: Event) => setPp((e as CustomEvent<number>).detail);
    window.addEventListener("pt:pp", on);
    return () => window.removeEventListener("pt:pp", on);
  }, []);

  const loadMore = useCallback(async () => {
    try {
      const r = await api<{ items: BattleCard[] }>("/api/feed");
      const done = doneIds();
      const fresh = r.items.filter((i) => !seen.current.has(i.id) && !done.has(i.id));
      fresh.forEach((i) => seen.current.add(i.id));
      if (fresh.length) setQueue((q) => [...q, ...fresh]);
    } catch {}
  }, []);

  useEffect(() => {
    if (queue.length < 3) loadMore();
  }, [queue.length, loadMore]);

  const advance = useCallback((dir: -1 | 1) => {
    setFly(dir);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setFly(0);
      setGrab(null);
      setThrown(null);
      setVoted(null);
      setResult(null);
    }, FLY_MS);
  }, []);

  const gated = !signedIn && guestLeft !== null && guestLeft <= 0;

  async function vote(side: Side): Promise<boolean> {
    if (!card || fly || gated) return false;
    if (voted === side) return true;
    const prev = voted;
    setVoted(side);
    const dwellMs = Date.now() - shownAt.current;
    setResult(pct(card.votesA + (side === "A" ? 1 : 0), card.votesB + (side === "B" ? 1 : 0)));
    // Remember it right away, so leaving the tab before the request finishes can't bring it back.
    markDone(card.id);
    // Wink the logo the instant the pick lands, not after the server answers.
    if (!prev) wink();
    try {
      const r = await api<VoteRes>(`/api/battles/${card.slug}/vote`, {
        body: { side, source: "feed", ...(prev ? {} : { dwellMs }) },
      });
      if (r.guestVotesLeft != null) setGuestLeft(r.guestVotesLeft);
      setResult(r.results);
      setPP(r.ppBalance);
      if (r.ppBalance != null) setPp(r.ppBalance);
      setSession((s) => ({ votes: s.votes + (prev ? 0 : 1), points: s.points + r.points }));
      if (r.points > 0) toast(`+${r.points} for voting`, "pp");
      return true;
    } catch (e) {
      if (prev) {
        setVoted(prev);
        toast((e as Error).message, "error");
        return false;
      }
      unmarkDone(card.id);
      if (e instanceof ApiError && e.code === "SIGNUP_REQUIRED") {
        setVoted(null);
        setResult(null);
        setGuestLeft(0);
        return false;
      }
      setVoted(null);
      setResult(null);
      toast((e as Error).message, "error");
      return false;
    }
  }

  /**
   * Drag a photo. Listeners live on window (not the photo) so the gesture always ends, even when
   * the mouse leaves the window, the tab loses focus or the browser cancels the pointer: whatever
   * ends it, past the line (or off the screen edge) is a pick, short of it springs back.
   */
  function startDrag(side: Side, e: React.PointerEvent) {
    drag.current?.end();
    const w = cardRef.current?.offsetWidth ?? 360;
    const d = { side, x: e.clientX, y: e.clientY, dx: 0, moved: false, w, lx: e.clientX, lt: e.timeStamp, v: 0, armed: false, end: () => {} };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - d.x;
      const dy = ev.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
      if (!d.moved) return;
      ev.preventDefault();
      const dt = ev.timeStamp - d.lt;
      if (dt > 0) d.v = 0.7 * ((ev.clientX - d.lx) / dt) + 0.3 * d.v;
      d.lx = ev.clientX;
      d.lt = ev.timeStamp;
      d.dx = dx;
      const isArmed = Math.abs(dx) > d.w * AWAY_FRAC;
      if (isArmed && !d.armed) buzz(8);
      d.armed = isArmed;
      setGrab({ side, dx, dy: dy * 0.6 });
      // Dragged right up to the screen edge: that's a pick, don't wait for the release.
      if (isArmed && (ev.clientX <= 2 || ev.clientX >= window.innerWidth - 2)) finish();
    };
    const finish = () => {
      cleanup();
      if (drag.current === d) drag.current = null;
      if (!d.moved) return;
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 400);
      const flung = Math.abs(d.v) > FLING_PX_MS && Math.abs(d.dx) > 24 && Math.sign(d.v) === Math.sign(d.dx);
      if (Math.abs(d.dx) > d.w * AWAY_FRAC || flung) swipeAway(side, d.dx < 0 ? -1 : 1);
      else setGrab(null);
    };
    const onUp = (ev: PointerEvent) => {
      if (d.moved) {
        d.dx = ev.clientX - d.x || d.dx;
      }
      finish();
    };
    const onLeave = (ev: MouseEvent) => {
      if (!ev.relatedTarget) finish(); // mouse left the window
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", finish);
      document.removeEventListener("mouseout", onLeave);
    };
    d.end = cleanup;
    drag.current = d;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("blur", finish);
    document.addEventListener("mouseout", onLeave);
  }

  // Every pick (tap, swipe-away, ← / →): the pick fills the card, its scores show for
  // RESULT_MS, then the next battle.
  async function pick(side: Side, dir: -1 | 1 = side === "A" ? -1 : 1) {
    if (!card || voted || fly || roll) return;
    const started = Date.now();
    const ok = await vote(side);
    if (!ok) {
      setThrown(null);
      return;
    }
    const n = ++rollCount.current;
    try {
      sessionStorage.setItem(ROLL_KEY, String(n));
    } catch {}
    setTimeout(() => buzz(10), 120);
    setTimeout(() => {
      advance(dir);
      if (isRollMilestone(n)) {
        setRoll(n);
        buzz(30);
      }
    }, Math.max(0, RESULT_MS - (Date.now() - started)));
  }

  // Swipe away: that photo flies off and the other one is the pick.
  function swipeAway(side: Side, dir: -1 | 1) {
    if (!card || thrown || voted || fly) return;
    buzz(18);
    setThrown({ side, dir });
    setGrab(null);
    pick(other(side), dir);
  }

  function skip() {
    if (!card || voted || fly || thrown || roll) return;
    markDone(card.id);
    api(`/api/battles/${card.slug}/skip`, { method: "POST" }).catch(() => {});
    advance(-1);
  }

  /** A flagged battle leaves the deck right away. */
  function afterFlag() {
    if (card && !voted) skip();
  }

  // Keyboard: ← A, → B, ↓ skip
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.querySelector("[data-flag-sheet]")) return;
      if (e.key === "ArrowLeft") pick("A");
      else if (e.key === "ArrowRight") pick("B");
      else if (e.key === "ArrowDown") skip();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const tier = pp != null ? pointsTier(pp, tiers.highAt, tiers.topAt) : null;
  const tierLine = tier ? (tier.next ? `${tier.toNext} ⚡ to ${tier.next} priority.` : "Top priority — your battles go first.") : null;

  const header = (
    <div className="sticky top-16 z-20 -mx-4 bg-page/95 px-4 pb-3 backdrop-blur">
      <p className="text-xs text-zinc-500" data-tour="status">
        {tierLine ?? (
          <>
            {guestLeft != null && guestLeft > 0
              ? `${guestLeft} free vote${guestLeft === 1 ? "" : "s"} left.`
              : guestLeft === 0
                ? "You’ve used your free votes."
                : "Votes count without an account."}{" "}
            <Link href="/signin?callbackUrl=/vote" className="text-accent">
              Sign up to earn ⚡
            </Link>
          </>
        )}
      </p>
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

  if (gated && !voted)
    return (
      <div>
        {header}
        <SignupGate limit={guestLimit} next="/vote" />
      </div>
    );

  const handle = card.authorHandle ? `@${card.authorHandle}` : (card.authorName ?? "someone");
  const parentOf = card.authorKidAges[0] ? `parent of a ${kidAgeLabel(card.authorKidAges[0])} y/o` : null;
  const avatarTone = AVATAR_TONES[session.votes % AVATAR_TONES.length];
  const style: React.CSSProperties = fly
    ? { transform: `translateX(${fly * 460}px) rotate(${fly * 16}deg)`, opacity: 0, transition: `transform ${FLY_MS}ms ease, opacity ${FLY_MS}ms ease` }
    : { transition: "transform 200ms ease" };

  const armed = !!grab && Math.abs(grab.dx) > (cardRef.current?.offsetWidth ?? 360) * AWAY_FRAC;
  // The photo that fills the card: the tapped pick, or the one left after a swipe-away.
  const winner: Side | null = thrown ? other(thrown.side) : voted;
  const EASE = "cubic-bezier(.2,1,.3,1)";
  const MOVE = `left 380ms ${EASE}, width 380ms ${EASE}, transform 320ms cubic-bezier(.2,1.4,.4,1), opacity 240ms ease, box-shadow 240ms ease`;

  function photoStyle(s: Side): React.CSSProperties {
    const half: React.CSSProperties = { left: s === "A" ? 0 : "calc(50% + 4px)", width: "calc(50% - 4px)" };
    if (thrown?.side === s) {
      const w = cardRef.current?.offsetWidth ?? 360;
      return {
        ...half,
        transform: `translate(${thrown.dir * (w + 160)}px, ${grab?.dy ?? -20}px) rotate(${thrown.dir * 28}deg) scale(1.05)`,
        transition: `transform ${THROW_MS}ms cubic-bezier(.4,.1,.8,.6)`,
        zIndex: 30,
        boxShadow: "0 30px 60px rgba(0,0,0,.28)",
      };
    }
    if (winner === s)
      return {
        left: 0,
        width: "100%",
        zIndex: 10,
        boxShadow: s === "A" ? "var(--shadow-glow-a)" : "var(--shadow-glow-b)",
        transition: MOVE,
      };
    // The one not picked (after a tap) steps back out of the way.
    if (winner) return { ...half, transform: "scale(0.9)", opacity: 0, pointerEvents: "none", transition: MOVE };
    if (grab?.side === s)
      return {
        ...half,
        transform: `translate(${grab.dx}px, ${grab.dy}px) rotate(${grab.dx / 14}deg) scale(1.04)`,
        zIndex: 30,
        boxShadow: "0 26px 50px rgba(0,0,0,.26)",
        cursor: "grabbing",
      };
    // While the other photo is dragged away, this one leans in as the pick-to-be.
    if (grab) return { ...half, transform: armed ? "scale(1.03)" : "scale(1)", zIndex: 5, transition: MOVE };
    // Not touched: spring back with a little overshoot.
    return { ...half, transition: MOVE };
  }


  return (
    <div>
      {header}
      <div className="relative h-[calc(100dvh-15.35rem)] min-h-[440px] md:h-[calc(100dvh-10rem)]">
        {roll != null && <RollCard count={roll} onDone={() => setRoll(null)} />}
        {peek && <div aria-hidden className="deck-peek absolute inset-0 translate-y-3 scale-95 rounded-[20px] bg-white opacity-70 shadow-soft" />}
        <article
          ref={cardRef}
          key={card.id}
          aria-label={card.title}
          className="deck-card animate-pop absolute inset-0 flex select-none flex-col rounded-[20px] bg-white p-4 shadow-card"
          style={style}
        >
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {card.authorHandle ? (
              <Link href={`/u/${card.authorHandle}`} data-nodrag className="flex min-w-0 items-center gap-2 py-1 hover:underline" aria-label={`${handle}'s profile`}>
                <AuthorDot handle={handle} image={card.authorImage} tone={TONE_CLASSES[avatarTone].solid} />
                <span className="truncate">
                  {handle}
                  <ExpertBadge tier={card.authorTier} className="ml-1" />
                  {parentOf && ` · ${parentOf}`}
                </span>
              </Link>
            ) : (
              <>
                <AuthorDot handle={handle} image={card.authorImage} tone={TONE_CLASSES[avatarTone].solid} />
                <span className="truncate">
                  {handle}
                  <ExpertBadge tier={card.authorTier} className="ml-1" />
                  {parentOf && ` · ${parentOf}`}
                </span>
              </>
            )}
            <span className="ml-auto shrink-0">{timeLeft(card.deadline)}</span>
          </div>
          <h1 className={`mt-3 ${titleSizeClass(card.title)}`} data-tour="question">
            <Link href={`/b/${card.slug}?src=feed`} data-nodrag className="hover:underline">
              {card.title}
            </Link>
          </h1>
          {card.context && <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-500">{card.context}</p>}

          <div className="relative mt-3 min-h-0 flex-1">
            {!grab && !winner && (
              <span
                aria-hidden
                className="vs-badge pointer-events-none absolute left-1/2 top-1/2 z-20 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white font-display text-[18px] italic shadow-[0_6px_16px_rgba(0,0,0,0.18)]"
              >
                vs
              </span>
            )}
            {(["A", "B"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="absolute inset-y-0 h-full max-h-full overflow-hidden touch-none rounded-[14px] p-0 shadow-photo will-change-transform"
                style={photoStyle(s)}
                data-tour={s === "A" ? "option-a" : "option-b"}
                aria-label={`Vote for ${s === "A" ? card.labelA : card.labelB}`}
                aria-pressed={voted === s}
                onPointerDown={(e) => {
                  if (fly || thrown || voted || gated || e.button > 0) return;
                  startDrag(s, e);
                }}
                onClick={() => {
                  if (justDragged.current) return;
                  if (!thrown) pick(s);
                }}
              >
                <OptionFace
                  side={s}
                  label={s === "A" ? card.labelA : card.labelB}
                  description={s === "A" ? card.descA : card.descB}
                  image={s === "A" ? card.imageA : card.imageB}
                  ring={winner === s}
                  hot={!!grab && grab.side !== s && armed}
                  big
                  className="absolute inset-0"
                >
                  {winner === s && result && (
                    <ResultBars side={s} everyone={result} experts={card.expert} onPhoto={!!(s === "A" ? card.imageA : card.imageB)} />
                  )}
                </OptionFace>
                {grab?.side === s && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 -rotate-6 whitespace-nowrap rounded-lg border-2 bg-black/55 px-2.5 py-1 text-[13px] font-bold uppercase tracking-wider text-white"
                    style={{ borderColor: "#fff", opacity: Math.min(1, Math.abs(grab.dx) / ((cardRef.current?.offsetWidth ?? 360) * AWAY_FRAC)) }}
                  >
                    Not this
                  </span>
                )}
              </button>
            ))}
            {!grab &&
              !thrown &&
              (["A", "B"] as const).map(
                (s) =>
                  (s === "A" ? card.imageA : card.imageB) &&
                  !winner && (
                    <PhotoFlag
                      key={s}
                      battleId={card.id}
                      side={s}
                      label={s === "A" ? card.labelA : card.labelB}
                      onFlagged={afterFlag}
                      className={s === "A" ? "right-[calc(50%+0.625rem)]" : undefined}
                    />
                  ),
              )}
          </div>

          {winner ? (
            <p className="mt-3 text-center font-display text-[26px] leading-tight" aria-live="polite">
              {winner === "A" ? card.labelA : card.labelB}
            </p>
          ) : (
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>Tap your pick, or swipe the other one away</span>
              <button type="button" data-nodrag data-tour="skip" className="btn-ghost !px-2 !py-1 text-[13px] text-ink" onClick={skip}>
                Skip
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

/** Poster's avatar on a deck card: their photo, else their initial. */
function AuthorDot({ handle, image, tone }: { handle: string; image: string | null; tone: string }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="size-5 shrink-0 rounded-full object-cover" />
  ) : (
    <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]", tone)} aria-hidden>
      {handle.replace(/^@/, "")[0]?.toUpperCase()}
    </span>
  );
}
