"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronUp, ExternalLink, Lock, Pencil, StopCircle, ThumbsDown, ThumbsUp, Trash2, Users, Zap } from "lucide-react";
import { ApiError, api, setPP, toast } from "@/lib/client";
import { markDone } from "@/lib/seen";
import { SignupGate } from "@/components/auth/SignupGate";
import { ResultBars } from "./ResultBars";
import { AboutCard, type AboutCardPayload } from "./AboutCard";
import { ExpertBadge } from "@/components/ui/ExpertBadge";
import { Scores } from "./Scores";
import { cn, formatPrice, timeAgo, timeLeft } from "@/lib/utils";
import { TITLE_MAX, TONE_CLASSES, kidAgeLabel } from "@/lib/constants";
import type { BattleView, ReasonView } from "@/server/services/battles";
import { Avatar } from "@/components/ui/Avatar";
import { OptionFace } from "./OptionFace";
import { CopyLink, ShareGrid, ShareIconButton } from "./ShareButtons";
import { ReportButton } from "./ReportButton";
import { PickbotMark } from "@/components/pickbot/PickbotMark";

type VoteRes = { results: { a: number; b: number; total: number }; points: number; ppBalance: number | null; gatePrompt?: boolean };
type V = NonNullable<BattleView>;

export function BattleClient({ initial, signedIn, shareUrl, source = "link" }: { initial: V; signedIn: boolean; shareUrl: string; source?: string }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(initial.myVote?.reason ?? "");
  const [reasonSaved, setReasonSaved] = useState(!!initial.myVote?.reason);
  const [editing, setEditing] = useState(false);
  const [gate, setGate] = useState(false);
  // Sign-up gate test, group B: the server lets the vote through and asks us to show the closable dialog.
  const [softGate, setSoftGate] = useState(false);
  // "People like you" locked row → reopen that about-you card here.
  const [aboutCard, setAboutCard] = useState<AboutCardPayload | null>(null);
  const mountedAt = useRef(Date.now());
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      setV(await api<V>(`/api/battles/${v.slug}`));
    } catch {}
  }, [v.slug]);

  // Live results while open (PRD 15: poll every 5s while visible)
  useEffect(() => {
    if (!v.isOpen || !v.results) return;
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 5000);
    return () => clearInterval(t);
  }, [v.isOpen, v.results, refresh]);

  async function vote(side: "A" | "B") {
    if (busy || !v.isOpen || v.isOwner || v.askerThreadId) return;
    if (v.myVote?.side === side) return;
    setBusy(true);
    const prev = v;
    setV({ ...v, myVote: { id: v.myVote?.id ?? "pending", side, reason: v.myVote?.reason ?? null } });
    try {
      const r = await api<VoteRes>(`/api/battles/${v.slug}/vote`, { body: { side, dwellMs: Date.now() - mountedAt.current, source } });
      markDone(v.id);
      if (r.points > 0) toast(`+${r.points} for voting — thanks for helping!`, "pp");
      setPP(r.ppBalance);
      if (r.gatePrompt) {
        setSoftGate(true);
        setGate(true);
      }
      await refresh();
    } catch (e) {
      setV(prev);
      if (e instanceof ApiError && e.code === "SIGNUP_REQUIRED") setGate(true);
      else toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveReason(text = reason) {
    if (!v.myVote || !text.trim()) return;
    setReason(text);
    try {
      const r = await api<VoteRes>(`/api/battles/${v.slug}/vote`, { body: { side: v.myVote.side, reason: text, source } });
      if (r.points > 0) toast(`+${r.points} for adding a reason`, "pp");
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
        toast("Boosted — your battle shows up first for the next few hours", "pp");
      } else if (action === "close") {
        if (!window.confirm("Close voting now?")) return;
        await api(`/api/battles/${v.slug}`, { method: "PATCH", body: { action: "close" } });
      } else {
        if (!window.confirm("Delete this battle? This can't be undone.")) return;
        await api(`/api/battles/${v.slug}`, { method: "DELETE" });
        router.push("/you");
        return;
      }
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const { A, B } = v.options;
  const res = v.results;
  const leader = res && res.total > 0 ? (res.a === res.b ? null : res.a > res.b ? "A" : "B") : null;
  const kidAges: string[] = v.tags?.target?.kidAges ?? v.tags?.kidAge ?? [];
  const loopPoints = v.loopRewards.loop;
  const allReasons = [...v.reasons.A, ...v.reasons.B].sort((x, y) => score(y) - score(x));
  const chosenLabel = v.outcome ? (v.outcome.chosen === "A" ? A.label : v.outcome.chosen === "B" ? B.label : "neither") : null;
  const showStickyLoop = (v.isOwner || !!v.askerThreadId) && !v.outcome && v.canReportOutcome;

  return (
    <article className={cn("space-y-5", showStickyLoop && "pb-20 md:pb-0")}>
      {v.isOwner && (
        <div className="-mx-2 flex h-11 items-center gap-1">
          <Link href="/you" className="rounded-lg p-2 hover:bg-surface" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="flex-1 text-[15px]">Your battle</span>
          <ShareIconButton url={shareUrl} title={v.title} />
        </div>
      )}

      {v.askerThreadId && (
        <>
          <div className="-mx-2 flex h-11 items-center gap-1">
            <Link href="/you" className="rounded-lg p-2 hover:bg-surface" aria-label="Back">
              <ArrowLeft className="size-5" />
            </Link>
            <span className="flex-1 text-[15px]">Your Pickbot question</span>
            <ShareIconButton url={shareUrl} title={v.title} />
          </div>
          <Link
            href={`/ask/${v.askerThreadId}`}
            className="flex items-center gap-3 rounded-[16px] bg-violet-soft px-3.5 py-3 text-[13px] text-ink"
            data-testid="pickbot-asker-banner"
          >
            <PickbotMark className="size-7" />
            <span className="min-w-0 flex-1">
              You asked this with Pickbot. Everyone else sees it as “Asked via Pickbot”, never your name.
              <span className="mt-0.5 block font-medium text-violet">Open your Pickbot chat →</span>
            </span>
          </Link>
        </>
      )}

      {v.outcome && <OutcomeBanner v={v} leader={leader} />}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {v.isOpen ? (
            <span className="tag bg-accent-900 text-accent">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden /> Live · {timeLeft(v.deadline)}
            </span>
          ) : v.outcome ? (
            <span className="tag bg-violet-soft text-violet">Closed · picked {chosenLabel}</span>
          ) : (
            <span className="tag bg-surface text-zinc-600">Voting closed</span>
          )}
          {kidAges.map((k) => (
            <span key={k} className={cn("tag", TONE_CLASSES.teal.soft)}>
              Kid {kidAgeLabel(k)}
            </span>
          ))}
          {v.visibility !== "PUBLIC" && (
            <span className="tag bg-surface text-zinc-600">
              {v.visibility === "FRIENDS" ? <Users className="size-3" aria-hidden /> : <Lock className="size-3" aria-hidden />}
              {v.visibility === "FRIENDS" ? "Friends only" : "Link only"}
            </span>
          )}
          {v.boostActive && (
            <span className="tag bg-amber-soft text-amber-700">
              <Zap className="size-3 fill-pp text-pp" aria-hidden /> Boosted
            </span>
          )}
        </div>
        {editing ? (
          <EditForm
            v={v}
            onDone={async () => {
              setEditing(false);
              await refresh();
            }}
          />
        ) : (
          <>
            <h1 className="text-[22px] leading-snug">{v.title}</h1>
            {v.context && <p className="text-[13px] text-zinc-500">{v.context}</p>}
          </>
        )}
        {!v.isOwner && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href={`/u/${v.author.handle}`} className="inline-flex items-center gap-1.5 py-1 hover:underline">
              <Avatar name={v.author.name || v.author.handle || "?"} seed={v.author.handle ?? undefined} src={v.author.image} size={24} />
              {v.author.name || `@${v.author.handle}`}
              <ExpertBadge tier={v.author.tier} />
            </Link>
            · {timeAgo(v.createdAt)}
          </div>
        )}
      </header>

      <div>
        <div className={cn("grid grid-cols-2 gap-2", res ? "h-[140px]" : "h-[200px]")}>
          {(["A", "B"] as const).map((s) => {
            const o = s === "A" ? A : B;
            const canVote = v.isOpen && !v.isOwner && !v.askerThreadId;
            const face = (
              <OptionFace
                side={s}
                label={o.label}
                description={o.description}
                image={o.imageUrl || o.urlImage}
                percent={res ? (s === "A" ? res.a : res.b) : null}
                ring={v.isOwner || v.askerThreadId || !v.isOpen ? leader === s : v.myVote?.side === s}
              />
            );
            return canVote ? (
              <button
                key={s}
                type="button"
                className="h-full active:scale-[0.98]"
                onClick={() => vote(s)}
                disabled={busy}
                aria-label={`Vote for ${o.label}`}
                aria-pressed={v.myVote?.side === s}
              >
                {face}
              </button>
            ) : (
              <div key={s} className="h-full">
                {face}
              </div>
            );
          })}
        </div>
        {(A.url || B.url || A.priceCents != null || B.priceCents != null) && (
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-zinc-500">
            {[A, B].map((o) => (
              <div key={o.id} className="flex items-center gap-2 px-0.5">
                {o.priceCents != null && <span>{formatPrice(o.priceCents, o.currency)}</span>}
                {o.url && (
                  <a href={`/go/${o.id}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-0.5 text-accent" aria-label={`Open link for ${o.label}`}>
                    View <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        {res && (
          <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            <span className="h-full rounded-l-full bg-accent transition-[width] duration-500" style={{ width: `${res.total ? res.a : 50}%` }} />
            <span className="h-full flex-1 rounded-r-full bg-b" />
          </div>
        )}
        <p className="mt-2 text-[13px] text-zinc-500">
          {res ? (
            <>
              {res.total} vote{res.total === 1 ? "" : "s"}
              {v.relevantVotes && v.relevantVotes.count > 0 && ` · ${v.relevantVotes.count} from parents of ${v.relevantVotes.ageLabel} year olds`}
              {v.myVote && v.isOpen && " · tap the other option to change your vote"}
            </>
          ) : v.isOpen && !v.isOwner && !v.askerThreadId ? (
            "Tap to vote — results appear after you pick"
          ) : !v.isOpen && !v.isOwner ? (
            "Voting has closed. Results are only shown to people who voted."
          ) : null}
        </p>
        {res && res.total > 0 && (
          <div className="mt-3">
            <Scores everyone={res} experts={v.expertResults} labelA={A.label} labelB={B.label} />
          </div>
        )}
        {v.likeYou && v.myVote && v.myVote.id !== "pending" && (
          <div className="mt-2 rounded-[14px] bg-surface px-3 py-2">
            <ResultBars side={v.myVote.side} everyone={null} likeYou={v.likeYou} onUnlock={(q) => setAboutCard({ id: q })} onPhoto={false} />
          </div>
        )}
        {aboutCard && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 md:items-center" onClick={() => setAboutCard(null)}>
            <div className="relative h-[min(560px,85dvh)] w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <AboutCard
                card={aboutCard}
                onDone={() => {
                  setAboutCard(null);
                  refresh();
                }}
              />
            </div>
          </div>
        )}
        {signedIn && v.myVote && v.myVote.id !== "pending" && !v.isOwner && (
          <Link href={`/b/${v.slug}/like-you`} className="mt-3 inline-flex items-center gap-1 text-sm text-accent">
            See who voted like you →
          </Link>
        )}
        {v.myVote && v.myVote.id !== "pending" && (
          <Link href="/ask" className="ml-4 mt-3 inline-flex items-center gap-1 text-sm text-accent" data-track="pickbot_from_battle">
            Stuck on your own choice? Ask Pickbot →
          </Link>
        )}
      </div>

      {/* Reason after voting */}
      {v.myVote && v.isOpen && !v.isOwner && (
        <section className="space-y-2">
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            Why {v.myVote.side === "A" ? A.label : B.label}? optional
            {signedIn && (
              <>
                {" "}
                · <Zap className="size-3 fill-pp text-pp" aria-hidden /> +1 for a reason
              </>
            )}
          </p>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Write one line…"
              maxLength={140}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonSaved(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && reason.trim() && saveReason()}
              aria-label="Reason for your vote"
            />
            <button className="btn-outline shrink-0" disabled={!reason.trim() || reasonSaved} onClick={() => saveReason()}>
              {reasonSaved ? "Saved" : "Add"}
            </button>
          </div>
        </section>
      )}

      {/* Anonymous voter nudge */}
      {!signedIn && v.myVote && (
        <div className="card space-y-3 p-4 text-center">
          <p className="text-[15px]">See how your vote compares with parents like you — and get your own questions answered.</p>
          <div className="flex justify-center gap-2">
            <Link href={`/signin?callbackUrl=/b/${v.slug}`} className="btn-cta">
              Create free account
            </Link>
            <Link href="/post" className="btn-outline">
              Post your own
            </Link>
          </div>
        </div>
      )}

      {/* Top reasons */}
      {res && allReasons.length > 0 && (
        <section aria-label="Reasons" className="space-y-2">
          <h2 className="text-[22px]">Top reasons</h2>
          <ReasonList reasons={allReasons} signedIn={signedIn} isOwner={v.isOwner} onChange={refresh} />
        </section>
      )}

      {v.isOwner && !v.outcome && !v.canReportOutcome && v.isOpen && (
        <p className="card p-3.5 text-[13px] text-zinc-600">
          Once you have {v.minVotesForLoop}+ votes or the deadline passes, you can close the loop and earn +{loopPoints} ⚡.
        </p>
      )}

      {/* Owner: share + manage */}
      {v.isOwner && (
        <section className="space-y-3 border-t border-ink/10 pt-5" aria-label="Share and manage">
          <h2 className="text-[22px]">Get more votes</h2>
          <CopyLink url={shareUrl} />
          <ShareGrid url={shareUrl} title={v.title} />
          <div className="flex flex-wrap gap-1 pt-1">
            {v.outcome && (
              <Link href={`/b/${v.slug}/report`} className="btn-ghost !px-2.5 !py-1.5 text-sm">
                <Pencil className="size-4" aria-hidden /> Edit outcome
              </Link>
            )}
            {v.isOpen && !v.boostActive && (
              <button className="btn-pp !px-2.5 !py-1.5 text-sm" onClick={() => ownerAction("boost")} disabled={(v.viewerPP ?? 0) < v.boostCost}>
                <Zap className="size-4 fill-pp text-pp" aria-hidden /> Boost ({v.boostCost} ⚡)
              </button>
            )}
            {v.canEdit && (
              <button className="btn-ghost !px-2.5 !py-1.5 text-sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden /> Edit
              </button>
            )}
            {v.isOpen && (
              <button className="btn-ghost !px-2.5 !py-1.5 text-sm text-ink" onClick={() => ownerAction("close")}>
                <StopCircle className="size-4" aria-hidden /> Close voting
              </button>
            )}
            <button className="btn-ghost !px-2.5 !py-1.5 text-sm text-b hover:bg-b-soft" onClick={() => ownerAction("delete")}>
              <Trash2 className="size-4" aria-hidden /> Delete
            </button>
          </div>
        </section>
      )}

      {!v.isOwner && (
        <div className="flex items-center justify-between border-t border-ink/10 pt-4">
          <ShareIconButton url={shareUrl} title={v.title} className="btn-ghost !px-3 !py-1.5 text-sm">
            Share
          </ShareIconButton>
          <ReportButton targetType="BATTLE" targetId={v.id} />
        </div>
      )}

      {showStickyLoop && (
        <div className="fixed inset-x-0 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-30 bg-gradient-to-t from-page via-page to-page/0 px-4 pb-3 pt-6 md:sticky md:bottom-0 md:px-0 md:pb-4">
          {/* Phones: pinned above the tab bar. Desktop: sticks to the bottom inside the page column (Alex, Nov 28: it floated off to the side). */}
          <Link href={`/b/${v.slug}/report`} className="btn-primary mx-auto w-full max-w-2xl py-3">
            Decided? Close the loop · +{loopPoints} <Zap className="size-4 fill-white" aria-hidden />
          </Link>
        </div>
      )}
      {gate && <SignupGate soft={softGate} next={`/b/${v.slug}`} place="battle" onClose={() => setGate(false)} />}
    </article>
  );
}

const score = (r: ReasonView) => r.helpful + (r.ownerHelpful ? 2 : 0);

function OutcomeBanner({ v, leader }: { v: V; leader: "A" | "B" | null }) {
  const o = v.outcome!;
  const chosenLabel = o.chosen === "A" ? v.options.A.label : o.chosen === "B" ? v.options.B.label : null;
  const poster = v.isOwner ? "You" : v.author.name || `@${v.author.handle}`;
  return (
    <div className="rounded-[14px] bg-violet-soft p-4">
      <div className="text-xs text-violet">Loop closed</div>
      <p className="mt-1 text-[17px] leading-snug">
        {chosenLabel ? (
          <>
            {poster} picked <b className="font-medium">{chosenLabel}</b>{" "}
            {o.thumb === "UP" ? (
              <span className="inline-flex items-center gap-1 text-green">
                · <ThumbsUp className="size-4" aria-hidden /> went well
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-zinc-600">
                · <ThumbsDown className="size-4" aria-hidden /> not great
              </span>
            )}
          </>
        ) : (
          <>{poster} went with neither option</>
        )}
      </p>
      {o.note && <p className="mt-1 text-[15px] text-zinc-700">“{o.note}”</p>}
      {chosenLabel && leader && v.results && (
        <p className="mt-2 text-[13px] text-zinc-600">
          {leader === o.chosen
            ? `The crowd agreed (${leader === "A" ? v.results.a : v.results.b}%)`
            : `The crowd picked the other one (${leader === "A" ? v.results.a : v.results.b}%)`}
        </p>
      )}
    </div>
  );
}

function ReasonList({ reasons, signedIn, isOwner, onChange }: { reasons: ReasonView[]; signedIn: boolean; isOwner: boolean; onChange: () => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? reasons : reasons.slice(0, 5);
  async function helpful(r: ReasonView) {
    if (!signedIn) return toast("Sign in to upvote reasons");
    try {
      await api(`/api/reasons/${r.voteId}/helpful`, { method: "POST" });
      onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <>
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.voteId} className="card flex gap-2.5 p-3">
            <span
              className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border bg-white text-[11px]", r.side === "A" ? "border-a text-a" : "border-b text-b")}
              aria-label={`Option ${r.side}`}
            >
              {r.side}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{r.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                {r.byHandle ? (
                  <Link href={`/u/${r.byHandle}`} className="hover:underline">
                    {r.by}
                  </Link>
                ) : (
                  r.by
                )}
                {r.ownerHelpful && <span className="text-amber-700">· poster found this helpful</span>}
                {!r.mine && <ReportButton targetType="REASON" targetId={r.voteId} small />}
              </div>
            </div>
            <button
              type="button"
              onClick={() => !r.mine && helpful(r)}
              disabled={r.mine}
              className={cn("flex h-fit shrink-0 flex-col items-center rounded-md px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-white", r.markedByMe && "text-accent")}
              aria-pressed={r.markedByMe}
              aria-label={isOwner ? "Mark helpful (+3 ⚡ to them)" : "Mark helpful"}
            >
              <ChevronUp className="size-4" aria-hidden />
              {r.helpful}
            </button>
          </li>
        ))}
      </ul>
      {reasons.length > 5 && (
        <button className="text-[13px] text-accent hover:underline" onClick={() => setAll(!all)}>
          {all ? "Show less" : `See all ${reasons.length}`}
        </button>
      )}
    </>
  );
}

function EditForm({ v, onDone }: { v: V; onDone: () => void }) {
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
      <input className="input" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <textarea className="input" rows={2} value={context} maxLength={280} onChange={(e) => setContext(e.target.value)} aria-label="Context" />
      <div className="flex gap-2">
        <button className="btn-primary !py-1.5" onClick={save}>
          Save
        </button>
        <button className="btn-ghost !py-1.5" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
