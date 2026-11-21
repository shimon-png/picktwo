"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Zap } from "lucide-react";
import { ApiError, api, setPP, toast } from "@/lib/client";
import { doneIds, markDone, unmarkDone } from "@/lib/seen";
import { SignupGate } from "@/components/auth/SignupGate";
import { cn, pct, timeLeft } from "@/lib/utils";
import { AVATAR_TONES, REASON_CHIPS, TONE_CLASSES, kidAgeLabel } from "@/lib/constants";
import { pointsTier } from "@/server/services/priority";
import type { BattleCard } from "@/server/services/battles";
import { OptionFace } from "./OptionFace";
import { PhotoFlag } from "./PhotoFlag";

type Side = "A" | "B";
type VoteRes = { results: { a: number; b: number; total: number }; points: number; ppBalance: number | null; guestVotesLeft?: number | null };

/**
 * Tinder-style photo throw: grab a photo, it lifts off the card and follows your finger;
 * fling it off either side to pick it, and the deck moves on by itself. Tapping a photo
 * picks it too but stays (results, reason chips, Next) so the pick can still change.
 */
const THROW_FRAC = 0.32; // drag past this share of the card width to throw…
const FLING_PX_MS = 0.55; // …or flick faster than this
const THROW_MS = 340;
const RESULT_MS = 1150; // how long the result shows after a throw before the next battle
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
  const [reason, setReason] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [fly, setFly] = useState<-1 | 1 | 0>(0);
  // The grabbed photo and its offset, and a photo that has been thrown off the card.
  const [grab, setGrab] = useState<{ side: Side; dx: number; dy: number } | null>(null);
  const [thrown, setThrown] = useState<{ side: Side; dir: -1 | 1 } | null>(null);
  const [pp, setPp] = useState(initialPP);
  const [session, setSession] = useState({ votes: 0, points: 0 });
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
      setReason(null);
      setWriting(false);
      setDraft("");
    }, FLY_MS);
  }, []);

  const gated = !signedIn && guestLeft !== null && guestLeft <= 0;

  // The pick stays changeable (tap the other photo, drag the other way, ← / →) until Next.
  async function vote(side: Side): Promise<boolean> {
    if (!card || fly || gated) return false;
    if (voted === side) return true;
    const prev = voted;
    setVoted(side);
    const dwellMs = Date.now() - shownAt.current;
    setResult(pct(card.votesA + (side === "A" ? 1 : 0), card.votesB + (side === "B" ? 1 : 0)));
    // A reason was for the old pick; clear it on the server too.
    const clearReason = !!prev && !!reason;
    if (prev) {
      setReason(null);
      setWriting(false);
      setDraft("");
    }
    // Remember it right away, so leaving the tab before the request finishes can't bring it back.
    markDone(card.id);
    try {
      const r = await api<VoteRes>(`/api/battles/${card.slug}/vote`, {
        body: { side, source: "feed", ...(prev ? {} : { dwellMs }), ...(clearReason ? { reason: "" } : {}) },
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
      const isArmed = Math.abs(dx) > d.w * THROW_FRAC;
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
      if (Math.abs(d.dx) > d.w * THROW_FRAC || flung) throwPhoto(side, d.dx < 0 ? -1 : 1);
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

  // Fling: the photo flies off, the vote counts, the result flashes, then the next battle.
  async function throwPhoto(side: Side, dir: -1 | 1) {
    if (!card || thrown || fly) return;
    buzz(18);
    setThrown({ side, dir });
    setGrab(null);
    const started = Date.now();
    const ok = await vote(side);
    if (!ok) {
      setThrown(null);
      return;
    }
    setTimeout(() => advance(dir), Math.max(0, RESULT_MS - (Date.now() - started)));
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
    if (!card || voted || fly || thrown) return;
    markDone(card.id);
    api(`/api/battles/${card.slug}/skip`, { method: "POST" }).catch(() => {});
    advance(-1);
  }

  /** A flagged battle leaves the deck right away. */
  function afterFlag() {
    if (!card) return;
    if (voted) next();
    else skip();
  }

  function next() {
    if (!voted || fly || thrown) return;
    advance(voted === "A" ? -1 : 1);
  }

  // Keyboard: ← A, → B, ↓ skip, Enter next
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.querySelector("[data-flag-sheet]")) return;
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
    <div className="sticky top-14 z-20 -mx-4 bg-page/95 px-4 pb-3 backdrop-blur">
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
  const chips = REASON_CHIPS;
  const style: React.CSSProperties = fly
    ? { transform: `translateX(${fly * 460}px) rotate(${fly * 16}deg)`, opacity: 0, transition: `transform ${FLY_MS}ms ease, opacity ${FLY_MS}ms ease` }
    : { transition: "transform 200ms ease" };

  function photoStyle(s: Side): React.CSSProperties {
    if (thrown?.side === s) {
      const w = cardRef.current?.offsetWidth ?? 360;
      return {
        transform: `translate(${thrown.dir * (w + 160)}px, ${grab?.dy ?? -20}px) rotate(${thrown.dir * 28}deg) scale(1.05)`,
        transition: `transform ${THROW_MS}ms cubic-bezier(.4,.1,.8,.6)`,
        zIndex: 30,
        boxShadow: "0 30px 60px rgba(0,0,0,.28)",
      };
    }
    if (grab?.side === s)
      return {
        transform: `translate(${grab.dx}px, ${grab.dy}px) rotate(${grab.dx / 14}deg) scale(1.06)`,
        zIndex: 30,
        boxShadow: "0 26px 50px rgba(0,0,0,.26)",
        cursor: "grabbing",
      };
    if (grab || thrown) return { transform: "scale(0.96)", opacity: thrown ? 1 : 0.6, transition: "transform 180ms ease, opacity 180ms ease" };
    // Lifted: the picked photo rises off the card with a glow in its side's colour.
    if (voted === s)
      return {
        transform: "translateY(-6px) scale(1.03)",
        zIndex: 10,
        boxShadow: s === "A" ? "var(--shadow-glow-a)" : "var(--shadow-glow-b)",
        transition: "transform 320ms cubic-bezier(.2,1.4,.4,1), box-shadow 240ms ease",
      };
    if (voted) return { transform: "scale(0.97)", opacity: 0.85, transition: "transform 240ms ease, opacity 240ms ease" };
    // Not touched: spring back with a little overshoot.
    return { transition: "transform 320ms cubic-bezier(.2,1.4,.4,1), opacity 180ms ease, box-shadow 200ms ease" };
  }

  const armed = !!grab && Math.abs(grab.dx) > (cardRef.current?.offsetWidth ?? 360) * THROW_FRAC;

  return (
    <div>
      {header}
      <div className="relative h-[calc(100dvh-14.5rem)] min-h-[440px] md:h-[calc(100dvh-10rem)]">
        {peek && <div aria-hidden className="absolute inset-0 translate-y-3 scale-95 rounded-[20px] bg-white opacity-70 shadow-soft" />}
        <article
          ref={cardRef}
          key={card.id}
          aria-label={card.title}
          className="animate-pop absolute inset-0 flex select-none flex-col rounded-[20px] bg-white p-4 shadow-card"
          style={style}
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
          <h1 className="mt-3 text-[28px] leading-[1.05]" data-tour="question">
            <Link href={`/b/${card.slug}?src=feed`} data-nodrag className="hover:underline">
              {card.title}
            </Link>
          </h1>
          {card.context && <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-500">{card.context}</p>}

          <div className="relative mt-3 grid min-h-0 flex-1 grid-cols-2 gap-2">
            {!grab && !thrown && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white font-display text-[18px] italic shadow-[0_6px_16px_rgba(0,0,0,0.18)]"
              >
                vs
              </span>
            )}
            {(["A", "B"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="relative h-full min-h-0 touch-none rounded-[14px] shadow-photo will-change-transform"
                style={photoStyle(s)}
                data-tour={s === "A" ? "option-a" : "option-b"}
                aria-label={`Vote for ${s === "A" ? card.labelA : card.labelB}`}
                aria-pressed={voted === s}
                onPointerDown={(e) => {
                  if (fly || thrown || gated || e.button > 0) return;
                  startDrag(s, e);
                }}
                onClick={() => {
                  if (justDragged.current) return;
                  if (!thrown) vote(s);
                }}
              >
                <OptionFace
                  side={s}
                  label={s === "A" ? card.labelA : card.labelB}
                  description={s === "A" ? card.descA : card.descB}
                  image={s === "A" ? card.imageA : card.imageB}
                  percent={result ? (s === "A" ? result.a : result.b) : null}
                  ring={voted === s}
                  hot={grab?.side === s && armed}
                  big
                />
              </button>
            ))}
            {!grab &&
              !thrown &&
              (["A", "B"] as const).map(
                (s) =>
                  (s === "A" ? card.imageA : card.imageB) && (
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

          {thrown ? (
            <p className="mt-3 text-center font-display text-[26px] leading-tight" aria-live="polite">
              {result ? `${thrown.side === "A" ? result.a : result.b}% picked ${thrown.side === "A" ? card.labelA : card.labelB}` : "Counted"}
            </p>
          ) : voted ? (
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
                        className="input !py-1.5"
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
                          className={cn("chip", reason === c && "chip-on")}
                        >
                          {c}
                        </button>
                      ))}
                      {!reason && (
                        <button type="button" className="chip text-zinc-500" onClick={() => setWriting(true)}>
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
              <span>Throw a photo off the card to pick it</span>
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
