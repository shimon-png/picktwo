"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { ApiError, api, setPP, toast } from "@/lib/client";
import { markDone } from "@/lib/seen";
import { SignupGate } from "@/components/auth/SignupGate";
import { ExpertBadge } from "@/components/ui/ExpertBadge";
import { Avatar } from "@/components/ui/Avatar";
import { cn, timeLeft, titleSizeClass } from "@/lib/utils";
import type { BattleView } from "@/server/services/battles";
import { OptionFace } from "./OptionFace";

type V = NonNullable<BattleView>;

/**
 * Vote-only battle view, opened from Discover for a battle you haven't voted on. No scores, Expert score or
 * reasons (you see those once you've voted). Tap a photo to vote, then you go straight back. X skips.
 */
export function DiscoverVote({ initial, source }: { initial: V; source: "discover" | "search" }) {
  const v = initial;
  const router = useRouter();
  const [picked, setPicked] = useState<"A" | "B" | null>(null);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [softGate, setSoftGate] = useState(false);
  const mountedAt = useRef(Date.now());

  function back() {
    // Back to wherever they came from (Discover, with its search) when there's history; else Discover.
    const internal = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin);
    if (internal && window.history.length > 1) router.back();
    else router.push("/discover");
  }

  async function vote(side: "A" | "B") {
    if (busy || picked) return;
    setBusy(true);
    setPicked(side);
    try {
      const r = await api<{ points: number; ppBalance: number | null; gatePrompt?: boolean }>(`/api/battles/${v.slug}/vote`, {
        body: { side, dwellMs: Date.now() - mountedAt.current, source },
      });
      markDone(v.id);
      navigator.vibrate?.(12);
      toast(r.points > 0 ? `Vote counted · +${r.points} ⚡` : "Vote counted", r.points > 0 ? "pp" : "ok");
      setPP(r.ppBalance);
      // Group B of the sign-up gate test: show the closable dialog; closing it goes back as usual.
      if (r.gatePrompt) {
        setSoftGate(true);
        setGate(true);
      } else setTimeout(back, 650);
    } catch (e) {
      setPicked(null);
      if (e instanceof ApiError && e.code === "SIGNUP_REQUIRED") setGate(true);
      else toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const done = !!v.myVote;
  const canVote = v.isOpen && !done && !picked;
  const name = v.author.name || `@${v.author.handle}`;

  return (
    <article className="relative space-y-4 pt-1">
      <button type="button" onClick={back} aria-label="Close, don't vote" className="absolute -right-1 top-0 z-10 rounded-full p-2 text-ink hover:bg-surface">
        <X className="size-6" />
      </button>

      <header className="space-y-2 pr-10">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          {v.author.handle && (
            <Link href={`/u/${v.author.handle}`} className="inline-flex items-center gap-1.5 py-1 hover:underline">
              <Avatar name={name} seed={v.author.handle} src={v.author.image} size={22} />
              {name}
              <ExpertBadge tier={v.author.tier} />
            </Link>
          )}
          <span>· {v.isOpen ? timeLeft(v.deadline) : "voting closed"}</span>
          <span>
            · {v.voteCount} vote{v.voteCount === 1 ? "" : "s"}
          </span>
        </div>
        <h1 className={titleSizeClass(v.title, "text-[28px] leading-[1.08]")}>{v.title}</h1>
        {v.context && <p className="text-[13px] text-zinc-500">{v.context}</p>}
      </header>

      <div className="grid h-[52vh] max-h-[440px] min-h-[260px] grid-cols-2 gap-2">
        {(["A", "B"] as const).map((s) => {
          const o = s === "A" ? v.options.A : v.options.B;
          const mine = picked === s || v.myVote?.side === s;
          const face = (
            <OptionFace side={s} label={o.label} description={o.description} image={o.imageUrl || o.urlImage} percent={null} ring={mine} big />
          );
          return canVote ? (
            <button key={s} type="button" onClick={() => vote(s)} disabled={busy} aria-label={`Vote for ${o.label}`} className="h-full transition active:scale-[0.98]">
              {face}
            </button>
          ) : (
            <div key={s} className={cn("h-full transition", (picked || done) && !mine && "opacity-40")}>
              {face}
            </div>
          );
        })}
      </div>

      <p className="text-center text-[13px] text-zinc-500">
        {picked ? (
          <span className="inline-flex items-center gap-1 text-ok">
            <Check className="size-4" /> Vote counted
          </span>
        ) : done ? (
          "You already voted on this one."
        ) : v.isOpen ? (
          "Tap your pick to vote. Results show once you vote."
        ) : (
          "Voting has closed on this one."
        )}
      </p>
      {(done || !v.isOpen) && !picked && (
        <div className="flex justify-center">
          <button type="button" onClick={back} className="btn-outline">
            Back
          </button>
        </div>
      )}
      {gate && (
        <SignupGate
          soft={softGate}
          next={`/b/${v.slug}?src=${source}`}
          place="discover"
          onClose={() => {
            setGate(false);
            if (softGate) back();
          }}
        />
      )}
    </article>
  );
}
