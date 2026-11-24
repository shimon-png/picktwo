"use client";
import Link from "next/link";
import { ExpertBadge } from "@/components/ui/ExpertBadge";
import { useRef, useState } from "react";
import { api, ApiError, toast } from "@/lib/client";
import { kidAgeLabel } from "@/lib/constants";
import { timeLeft } from "@/lib/utils";
import type { BattleCard } from "@/server/services/battles";
import { Avatar } from "@/components/ui/Avatar";
import { OptionFace } from "./OptionFace";

/** Homepage live battle: one tap votes anonymously (device cookie) and reveals the split. */
export function HeroBattle({ b, onVoted, onGate, gated = false }: { b: BattleCard; onVoted?: () => void; onGate?: () => void; gated?: boolean }) {
  const [picked, setPicked] = useState<"A" | "B" | null>(null);
  const [res, setRes] = useState<{ a: number; b: number; total: number } | null>(null);
  const shownAt = useRef(Date.now());
  const handle = b.authorHandle ? `@${b.authorHandle}` : (b.authorName ?? "someone");
  const parentOf = b.authorKidAges[0] ? `parent of a ${kidAgeLabel(b.authorKidAges[0])} y/o` : null;

  async function vote(side: "A" | "B") {
    if (picked) return;
    // Free votes used up: go straight to sign-up instead of a vote that would be refused.
    if (gated) return onGate?.();
    setPicked(side);
    try {
      const r = await api<{ results: { a: number; b: number; total: number } }>(`/api/battles/${b.slug}/vote`, {
        body: { side, dwellMs: Date.now() - shownAt.current, source: "home" },
      });
      setRes(r.results);
      onVoted?.();
    } catch (e) {
      setPicked(null);
      setRes(null);
      if (e instanceof ApiError && e.code === "SIGNUP_REQUIRED") onGate?.();
      else toast((e as Error).message, "error");
    }
  }

  return (
    <div className="relative rounded-[22px] bg-white p-4 shadow-lift">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Avatar name={handle} seed={b.authorHandle ?? b.id} src={b.authorImage} />
        <span className="truncate">
          {handle}
          <ExpertBadge tier={b.authorTier} className="ml-1" />
          {parentOf && ` · ${parentOf}`}
        </span>
        <span className="ml-auto shrink-0">{timeLeft(b.deadline)}</span>
      </div>
      <h2 className="mt-2.5 text-lg leading-snug">{b.title}</h2>
      {b.context && <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-500">{b.context}</p>}
      <div className="mt-3 grid h-[190px] grid-cols-2 gap-2">
        {(["A", "B"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => vote(s)}
            disabled={!!picked}
            aria-pressed={picked === s}
            aria-label={`Vote for ${s === "A" ? b.labelA : b.labelB}`}
            className="h-full active:scale-[0.98] disabled:active:scale-100"
          >
            <OptionFace
              side={s}
              label={s === "A" ? b.labelA : b.labelB}
              image={s === "A" ? b.imageA : b.imageB}
              percent={res ? (s === "A" ? res.a : res.b) : null}
              ring={picked === s}
              big
            />
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[13px] text-zinc-500" aria-live="polite">
        {res ? (
          <>
            Counted. {res.total} {res.total === 1 ? "person" : "people"} weighed in —{" "}
            <Link href="/vote" className="text-accent">
              next battle →
            </Link>
          </>
        ) : (
          "Tap one to vote · no account needed"
        )}
      </p>
    </div>
  );
}
