"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Heart, Lock, Share2, ThumbsDown, ThumbsUp, Trash2, Zap, Pencil, StopCircle, Users } from "lucide-react";
import { api, setPP, toast } from "@/lib/client";
import { cn, timeLeft, timeAgo } from "@/lib/utils";
import { kidAgeLabel } from "@/lib/constants";
import type { BattleView, ReasonView } from "@/server/services/battles";
import { OptionTile } from "./OptionTile";
import { ShareButtons } from "./ShareButtons";
import { ReportButton } from "./ReportButton";

type VoteRes = { results: { a: number; b: number; total: number }; points: number; ppBalance: number | null };

export function BattleClient({ initial, signedIn, shareUrl, source = "link" }: { initial: NonNullable<BattleView>; signedIn: boolean; shareUrl: string; source?: string }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(initial.myVote?.reason ?? "");
  const [reasonSaved, setReasonSaved] = useState(!!initial.myVote?.reason);
  const [editing, setEditing] = useState(false);
  const mountedAt = useRef(Date.now());
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      setV(await api<NonNullable<BattleView>>(`/api/battles/${v.slug}`));
    } catch {}
  }, [v.slug]);

  // Live results while open (PRD 15: poll every 5s while visible)
  useEffect(() => {
    if (!v.isOpen || !v.results) return;
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 5000);
    return () => clearInterval(t);
  }, [v.isOpen, v.results, refresh]);

  async function vote(side: "A" | "B") {
    if (busy || !v.isOpen || v.isOwner) return;
    if (v.myVote?.side === side) return;
    setBusy(true);
    // optimistic
    const prev = v;
    setV({ ...v, myVote: { id: v.myVote?.id ?? "pending", side, reason: v.myVote?.reason ?? null } });
    try {
      const r = await api<VoteRes>(`/api/battles/${v.slug}/vote`, {
        body: { side, dwellMs: Date.now() - mountedAt.current, source },
      });
      if (r.points > 0) toast(`+${r.points} ⚡ — thanks for helping!`, "pp");
      setPP(r.ppBalance);
      await refresh();
    } catch (e) {
      setV(prev);
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveReason() {
    if (!v.myVote) return;
    try {
      const r = await api<VoteRes>(`/api/battles/${v.slug}/vote`, { body: { side: v.myVote.side, reason, source } });
      if (r.points > 0) toast(`+${r.points} ⚡ for adding a reason`, "pp");
      setPP(r.ppBalance);
      setReasonSaved(true);
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function ownerAction(action: "close" | "boost" | "delete") {
    try {
      if (action === "boost") {
        const r = await api<{ ppBalance: number }>(`/api/battles/${v.slug}/boost`, { method: "POST" });
        setPP(r.ppBalance);
        toast("Boosted! Your battle will show up first for the next few hours ⚡", "pp");
      } else if (action === "close") {
        if (!confirmAction("Close voting now?")) return;
        await api(`/api/battles/${v.slug}`, { method: "PATCH", body: { action: "close" } });
      } else {
        if (!confirmAction("Delete this battle? This can't be undone.")) return;
        await api(`/api/battles/${v.slug}`, { method: "DELETE" });
        router.push("/");
        return;
      }
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const { A, B } = v.options;
  const res = v.results;
  const crowdWinner = res ? (res.a === res.b ? null : res.a > res.b ? "A" : "B") : null;
  const tags = [
    ...(v.tags?.kidAge ?? []).map((k: string) => `Kid ${kidAgeLabel(k)}`),
    v.tags?.recipient,
    v.tags?.budget,
    v.tags?.occasion,
  ].filter(Boolean) as string[];

  return (
    <article className="space-y-5">
      {v.outcome && <OutcomeBanner v={v} crowdWinner={crowdWinner} />}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
          <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 dark:bg-zinc-800">
            {v.category.emoji} {v.category.name}
          </span>
          <span className={cn("inline-flex items-center gap-1", v.isOpen ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-500")}>
            <Clock className="size-3.5" /> {v.isOpen ? timeLeft(v.deadline) : "Voting closed"}
          </span>
          {v.visibility !== "PUBLIC" && (
            <span className="inline-flex items-center gap-1">
              {v.visibility === "FRIENDS" ? <Users className="size-3.5" /> : <Lock className="size-3.5" />}
              {v.visibility === "FRIENDS" ? "Friends only" : "Link only"}
            </span>
          )}
          {v.boostActive && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Zap className="size-3.5 fill-pp text-pp" /> Boosted
            </span>
          )}
        </div>
        {editing ? (
          <EditForm v={v} onDone={async () => { setEditing(false); await refresh(); }} />
        ) : (
          <>
            <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{v.title}</h1>
            {v.context && <p className="text-[15px] text-zinc-600 dark:text-zinc-400">{v.context}</p>}
          </>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="text-sm text-zinc-500">
          Asked by{" "}
          <Link href={`/u/${v.author.handle}`} className="font-semibold text-zinc-800 hover:underline dark:text-zinc-200">
            {v.author.name || `@${v.author.handle}`}
          </Link>{" "}
          · {timeAgo(v.createdAt)}
        </div>
      </header>

      <div className="flex gap-3">
        {(["A", "B"] as const).map((s) => {
          const o = s === "A" ? A : B;
          return (
            <OptionTile
              key={s}
              option={o}
              percent={res ? (s === "A" ? res.a : res.b) : null}
              selected={v.myVote?.side === s}
              winner={crowdWinner === s}
              picked={v.outcome?.chosen === s}
              thumb={v.outcome?.chosen === s ? v.outcome.thumb : null}
              onClick={v.isOpen && !v.isOwner ? () => vote(s) : undefined}
              disabled={busy}
            />
          );
        })}
      </div>

      <div className="text-center text-sm text-zinc-500">
        {res ? (
          <>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{res.total}</span> vote{res.total === 1 ? "" : "s"}
            {v.myVote && v.isOpen && <> · tap the other option to change your vote</>}
          </>
        ) : v.isOpen ? (
          v.isOwner ? null : <span className="font-medium">Tap to vote — results appear after you pick</span>
        ) : null}
      </div>

      {/* Reason input after voting */}
      {v.myVote && v.isOpen && (
        <div className="card flex items-center gap-2 p-2 pl-3">
          <input
            className="flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-zinc-400"
            placeholder={`Why ${v.myVote.side === "A" ? A.label : B.label}? (one line, optional)`}
            maxLength={140}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonSaved(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && reason.trim() && saveReason()}
            aria-label="Reason for your vote"
          />
          <button className="btn-primary !px-3 !py-1.5" disabled={!reason.trim() || reasonSaved} onClick={saveReason}>
            {reasonSaved ? "Saved" : "Add"}
          </button>
        </div>
      )}

      {/* Anonymous voter nudge */}
      {!signedIn && v.myVote && (
        <div className="card flex flex-col items-center gap-3 p-5 text-center">
          <p className="font-semibold">See how your vote compares with parents like you — and get your own questions answered.</p>
          <div className="flex gap-2">
            <Link href={`/signin?callbackUrl=/b/${v.slug}`} className="btn-primary">
              Create free account
            </Link>
            <Link href="/post" className="btn-outline">
              Post your own
            </Link>
          </div>
        </div>
      )}

      {/* Owner controls */}
      {v.isOwner && (
        <section className="card space-y-3 p-4" aria-label="Your battle">
          {!v.outcome && v.canReportOutcome && (
            <Link href={`/b/${v.slug}/report`} className="btn w-full bg-gradient-to-r from-a to-b py-3 text-base text-white">
              Close the loop · which did you pick? <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">+10 ⚡</span>
            </Link>
          )}
          {!v.outcome && !v.canReportOutcome && v.isOpen && (
            <p className="text-sm text-zinc-500">
              Once you have {v.minVotesForLoop}+ votes or the deadline passes, you can report back which you picked and earn priority.
            </p>
          )}
          {v.outcome && (
            <Link href={`/b/${v.slug}/report`} className="text-sm font-semibold text-zinc-600 underline">
              Edit your report-back
            </Link>
          )}
          <ShareButtons url={shareUrl} title={v.title} />
          <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {v.isOpen && !v.boostActive && (
              <button className="btn-pp !py-1.5" onClick={() => ownerAction("boost")} disabled={(v.viewerPP ?? 0) < v.boostCost}>
                <Zap className="size-4" /> Boost ({v.boostCost} ⚡)
              </button>
            )}
            {v.canEdit && (
              <button className="btn-ghost !py-1.5" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </button>
            )}
            {v.isOpen && (
              <button className="btn-ghost !py-1.5" onClick={() => ownerAction("close")}>
                <StopCircle className="size-4" /> Close voting
              </button>
            )}
            <button className="btn-ghost !py-1.5 text-red-600" onClick={() => ownerAction("delete")}>
              <Trash2 className="size-4" /> Delete
            </button>
          </div>
        </section>
      )}

      {/* Reasons */}
      {res && (v.reasons.A.length > 0 || v.reasons.B.length > 0) && (
        <section aria-label="Reasons" className="grid gap-4 sm:grid-cols-2">
          {(["A", "B"] as const).map((s) => (
            <ReasonList
              key={s}
              side={s}
              label={s === "A" ? A.label : B.label}
              reasons={v.reasons[s]}
              signedIn={signedIn}
              isOwner={v.isOwner}
              onChange={refresh}
            />
          ))}
        </section>
      )}

      {!v.isOwner && (
        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <ShareIcon url={shareUrl} title={v.title} />
          <ReportButton targetType="BATTLE" targetId={v.id} />
        </div>
      )}
    </article>
  );
}

function confirmAction(msg: string) {
  return typeof window !== "undefined" ? window.confirm(msg) : false;
}

function OutcomeBanner({ v, crowdWinner }: { v: NonNullable<BattleView>; crowdWinner: string | null }) {
  const o = v.outcome!;
  const chosenLabel = o.chosen === "A" ? v.options.A.label : o.chosen === "B" ? v.options.B.label : null;
  const poster = v.author.name || `@${v.author.handle}`;
  return (
    <div className={cn("rounded-2xl p-4 text-white shadow", o.thumb === "DOWN" ? "bg-zinc-800" : "bg-gradient-to-r from-ok to-emerald-500")}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-90">Loop closed</div>
      <p className="mt-1 text-lg font-bold">
        {chosenLabel ? (
          <>
            {poster} picked <span className="underline decoration-white/50 underline-offset-4">{chosenLabel}</span>{" "}
            {o.thumb === "UP" ? (
              <span className="inline-flex items-center gap-1">
                · <ThumbsUp className="size-5" /> it worked out
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                · <ThumbsDown className="size-5" /> not great
              </span>
            )}
          </>
        ) : (
          <>{poster} went with neither option</>
        )}
      </p>
      {o.note && <p className="mt-1 text-[15px] opacity-95">“{o.note}”</p>}
      {chosenLabel && crowdWinner && v.results && (
        <p className="mt-2 text-sm opacity-90">
          {crowdWinner === o.chosen
            ? `The crowd agreed (${crowdWinner === "A" ? v.results.a : v.results.b}%)`
            : `The crowd picked the other one (${crowdWinner === "A" ? v.results.a : v.results.b}%)`}
        </p>
      )}
    </div>
  );
}

function ReasonList({
  side,
  label,
  reasons,
  signedIn,
  isOwner,
  onChange,
}: {
  side: "A" | "B";
  label: string;
  reasons: ReasonView[];
  signedIn: boolean;
  isOwner: boolean;
  onChange: () => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? reasons : reasons.slice(0, 3);
  async function helpful(r: ReasonView) {
    if (!signedIn) return toast("Sign in to mark reasons helpful");
    try {
      await api(`/api/reasons/${r.voteId}/helpful`, { method: "POST" });
      onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <div>
      <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-bold", side === "A" ? "text-a" : "text-b")}>
        <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] text-white", side === "A" ? "bg-a" : "bg-b")}>{side}</span>
        Why {label}
      </h2>
      {reasons.length === 0 && <p className="text-sm text-zinc-400">No reasons yet.</p>}
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.voteId} className="card p-3">
            <p className="text-[15px]">{r.text}</p>
            <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-500">
              <span>
                {r.byHandle ? <Link href={`/u/${r.byHandle}`} className="hover:underline">{r.by}</Link> : r.by}
                {r.ownerHelpful && <span className="ml-1.5 rounded-full bg-pp-soft px-1.5 py-0.5 font-semibold text-amber-700">Poster found this helpful</span>}
              </span>
              <span className="flex items-center gap-1">
                {!r.mine && (
                  <button
                    onClick={() => helpful(r)}
                    className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800", r.markedByMe && "text-b")}
                    aria-pressed={r.markedByMe}
                    aria-label={isOwner ? "Mark helpful (+3 ⚡ to them)" : "Mark helpful"}
                  >
                    <Heart className={cn("size-3.5", r.markedByMe && "fill-b")} /> {r.helpful || ""}
                  </button>
                )}
                {!r.mine && <ReportButton targetType="REASON" targetId={r.voteId} small />}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {reasons.length > 3 && (
        <button className="mt-2 text-sm font-semibold text-zinc-600 hover:underline" onClick={() => setAll(!all)}>
          {all ? "Show less" : `See all ${reasons.length}`}
        </button>
      )}
    </div>
  );
}

function EditForm({ v, onDone }: { v: NonNullable<BattleView>; onDone: () => void }) {
  const [title, setTitle] = useState(v.title);
  const [context, setContext] = useState(v.context ?? "");
  async function save() {
    try {
      await api(`/api/battles/${v.slug}`, { method: "PATCH", body: { action: "edit", title, context } });
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <div className="space-y-2">
      <input className="input font-semibold" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <textarea className="input" rows={2} value={context} maxLength={280} onChange={(e) => setContext(e.target.value)} aria-label="Context" />
      <div className="flex gap-2">
        <button className="btn-primary !py-1.5" onClick={save}>Save</button>
        <button className="btn-ghost !py-1.5" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function ShareIcon({ url, title }: { url: string; title: string }) {
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Help me choose: ${title}`, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  }
  return (
    <button className="btn-ghost !px-3 !py-1.5" onClick={share}>
      <Share2 className="size-4" /> Share
    </button>
  );
}

