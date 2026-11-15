"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock, MessageSquarePlus } from "lucide-react";
import { api, setPP, toast } from "@/lib/client";
import { cn, pct, timeLeft } from "@/lib/utils";
import { CATEGORIES, categoryById } from "@/lib/constants";
import type { BattleCard } from "@/server/services/battles";

type Phase = "idle" | "result" | "leaving";

export function SwipeDeck({ initial, category, signedIn }: { initial: BattleCard[]; category: string | null; signedIn: boolean }) {
  const router = useRouter();
  const [queue, setQueue] = useState(initial);
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<"A" | "B" | "skip" | null>(null);
  const [result, setResult] = useState<{ a: number; b: number; total: number } | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [session, setSession] = useState({ votes: 0, points: 0, agreed: 0 });
  const [drag, setDrag] = useState(0);
  const shownAt = useRef(Date.now());
  const dragStart = useRef<number | null>(null);
  const seen = useRef(new Set(initial.map((i) => i.id)));
  const card = queue[0];

  useEffect(() => {
    shownAt.current = Date.now();
  }, [card?.id]);

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

  const advance = useCallback(() => {
    setPhase("leaving");
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setPhase("idle");
      setPicked(null);
      setResult(null);
      setReason("");
      setReasonOpen(false);
      setDrag(0);
    }, 330);
  }, []);

  // Auto-advance after result flash, unless writing a reason
  useEffect(() => {
    if (phase !== "result" || reasonOpen) return;
    const t = setTimeout(advance, 1300);
    return () => clearTimeout(t);
  }, [phase, reasonOpen, advance]);

  async function vote(side: "A" | "B") {
    if (!card || phase !== "idle") return;
    setPicked(side);
    const dwellMs = Date.now() - shownAt.current;
    const optimistic = pct(card.votesA + (side === "A" ? 1 : 0), card.votesB + (side === "B" ? 1 : 0));
    setResult(optimistic);
    setPhase("result");
    try {
      const r = await api<{ results: { a: number; b: number; total: number }; points: number; ppBalance: number | null }>(`/api/battles/${card.slug}/vote`, {
        body: { side, dwellMs, source: "feed" },
      });
      setResult(r.results);
      setPP(r.ppBalance);
      const agreed = (side === "A" ? r.results.a : r.results.b) >= 50 ? 1 : 0;
      setSession((s) => {
        const n = { votes: s.votes + 1, points: s.points + r.points, agreed: s.agreed + agreed };
        if (n.votes % 10 === 0) toast(`${n.votes} votes · +${n.points} ⚡ · you agreed with the majority ${n.agreed}/${n.votes}`, "pp");
        else if (r.points > 0) toast(`+${r.points} ⚡`, "pp");
        return n;
      });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function saveReason() {
    if (!card || !picked || picked === "skip" || !reason.trim()) return advance();
    try {
      const r = await api<{ points: number; ppBalance: number | null }>(`/api/battles/${card.slug}/vote`, { body: { side: picked, reason, source: "feed" } });
      if (r.points) toast(`+${r.points} ⚡ for your reason`, "pp");
      setPP(r.ppBalance);
    } catch (e) {
      toast((e as Error).message, "error");
    }
    advance();
  }

  async function skip() {
    if (!card || phase !== "idle") return;
    setPicked("skip");
    api(`/api/battles/${card.slug}/skip`, { method: "POST" }).catch(() => {});
    advance();
  }

  // Keyboard: ← A, → B, ↓ skip, R reason (PRD V-9)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") vote("A");
      else if (e.key === "ArrowRight") vote("B");
      else if (e.key === "ArrowDown") skip();
      else if (e.key.toLowerCase() === "r" && phase === "result") setReasonOpen(true);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const cats = (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <button className={cn("chip shrink-0", !category && "chip-on")} onClick={() => router.push("/vote")}>
        All
      </button>
      {CATEGORIES.map((c) => (
        <button key={c.id} className={cn("chip shrink-0", category === c.id && "chip-on")} onClick={() => router.push(`/vote?category=${c.id}`)}>
          {c.emoji} {c.name}
        </button>
      ))}
    </div>
  );

  if (!card)
    return (
      <div>
        {cats}
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <div className="text-5xl">🎉</div>
          <h1 className="font-display text-xl font-extrabold">You’ve voted on everything!</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {session.votes > 0 ? `${session.votes} votes this session, +${session.points} ⚡ earned. ` : ""}Got a decision of your own?
          </p>
          <Link href="/post" className="btn-primary">
            Post a battle
          </Link>
        </div>
      </div>
    );

  const cat = categoryById(card.categoryId);
  const flyClass = phase === "leaving" ? (picked === "A" ? "fly-A" : picked === "B" ? "fly-B" : "fly-skip") : "";

  return (
    <div>
      {cats}
      <div className="mb-2 flex items-center justify-between text-sm text-zinc-500">
        <span>
          {session.votes} voted{signedIn ? ` · +${session.points} ⚡` : ""}
        </span>
        {!signedIn && (
          <Link href="/signin?callbackUrl=/vote" className="font-semibold text-zinc-800 underline dark:text-zinc-200">
            Sign in to earn ⚡
          </Link>
        )}
      </div>
      <div
        key={card.id}
        className={cn("card animate-pop touch-pan-y select-none space-y-4 p-4", flyClass)}
        style={drag ? { transform: `translateX(${drag}px) rotate(${drag / 25}deg)` } : undefined}
        onPointerDown={(e) => {
          if (phase === "idle" && e.pointerType !== "mouse") dragStart.current = e.clientX;
        }}
        onPointerMove={(e) => dragStart.current != null && setDrag(e.clientX - dragStart.current)}
        onPointerUp={() => {
          if (dragStart.current == null) return;
          dragStart.current = null;
          if (drag < -80) vote("A");
          else if (drag > 80) vote("B");
          setDrag(0);
        }}
        onPointerCancel={() => {
          dragStart.current = null;
          setDrag(0);
        }}
      >
        <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            {cat.emoji} {cat.name}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {timeLeft(card.deadline)}
          </span>
        </div>
        <div>
          <Link href={`/b/${card.slug}?src=feed`} className="font-display text-xl font-extrabold leading-tight hover:underline">
            {card.title}
          </Link>
          {card.context && <p className="mt-1 text-[15px] text-zinc-600 dark:text-zinc-400">{card.context}</p>}
          <p className="mt-1 text-xs text-zinc-400">by {card.authorName || `@${card.authorHandle}`}</p>
        </div>
        <div className="flex gap-3">
          {(["A", "B"] as const).map((s) => {
            const label = s === "A" ? card.labelA : card.labelB;
            const img = s === "A" ? card.imageA : card.imageB;
            const p = result ? (s === "A" ? result.a : result.b) : null;
            const isA = s === "A";
            return (
              <button
                key={s}
                onClick={() => vote(s)}
                disabled={phase !== "idle"}
                aria-label={`Vote for ${label}`}
                className={cn(
                  "relative flex aspect-square flex-1 flex-col overflow-hidden rounded-2xl border-2 transition active:scale-[0.97]",
                  isA ? "border-a/25 bg-a-soft dark:bg-a/15" : "border-b/25 bg-b-soft dark:bg-b/15",
                  picked === s && (isA ? "border-a ring-4 ring-a/30" : "border-b ring-4 ring-b/30"),
                  drag < -30 && isA && "ring-4 ring-a/40",
                  drag > 30 && !isA && "ring-4 ring-b/40",
                )}
              >
                {img ? (
                  <img src={img} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
                ) : (
                  <span className={cn("m-auto p-3 text-center font-display text-lg font-extrabold leading-tight sm:text-xl", isA ? "text-a" : "text-b")}>{label}</span>
                )}
                <span className={cn("absolute left-2 top-2 flex size-7 items-center justify-center rounded-full text-sm font-extrabold text-white", isA ? "bg-a" : "bg-b")}>{s}</span>
                {p != null && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 font-display text-4xl font-extrabold text-white">{p}%</span>
                )}
                {img && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-left text-sm font-semibold text-white">
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {phase === "result" && !reasonOpen && signedIn && (
          <button className="btn-ghost w-full !py-1.5" onClick={() => setReasonOpen(true)}>
            <MessageSquarePlus className="size-4" /> Add why (+1 ⚡)
          </button>
        )}
        {reasonOpen && (
          <div className="flex gap-2">
            <input
              autoFocus
              className="input !py-2"
              placeholder="One line on why…"
              maxLength={140}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveReason()}
              aria-label="Reason"
            />
            <button className="btn-primary !py-2" onClick={saveReason}>
              {reason.trim() ? "Add" : "Next"}
            </button>
          </div>
        )}
        {phase === "idle" && (
          <button className="mx-auto flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-800" onClick={skip}>
            <ChevronDown className="size-4" /> Not for me
          </button>
        )}
      </div>
      <p className="mt-3 hidden text-center text-xs text-zinc-400 md:block">Keyboard: ← A · → B · ↓ skip · R add reason</p>
    </div>
  );
}
