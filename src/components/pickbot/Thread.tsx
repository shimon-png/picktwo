"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { api, toast } from "@/lib/client";
import { cn, pct } from "@/lib/utils";
import { CONFIDENCE_LABEL, partialField, type Answer, type AnswerKind } from "@/lib/pickbot";
import type { ThreadView } from "@/server/services/pickbot";
import { AskComposer } from "./AskComposer";
import { PushButton } from "@/components/app/PushButton";
import { PREFER_NOT, cardOrder } from "@/lib/about";

type Msg = ThreadView["messages"][number];
type Similar = { slug: string; title: string; a: string; b: string; votesA: number; votesB: number; likeA: number | null; likeB: number | null };

const WHY: Record<string, string> = {
  sex: "People of different backgrounds choose very differently.",
  age: "What fits at 22 isn't what fits at 45.",
  relationship: "Your life stage changes a lot of answers.",
  zip: "Where you live changes prices, weather and what's normal. Only the area is used.",
  kids: "Kids change a lot of decisions.",
  housing: "Renting or owning changes the math.",
  work: "Your days shape what makes sense.",
  education: "School years shape a lot of choices.",
  race: "Background changes what people pick. Prefer not to say is fine.",
  party: "Views shape some choices. Prefer not to say is fine.",
};

/** Bright answer tiles (globals.css `qtile-*`), by position. */
const TILE = ["qtile-1", "qtile-2", "qtile-3", "qtile-4", "qtile-5", "qtile-6"];

/** What the profile cards buy, said before the first one (Alex, Nov 26: explain why answering makes the advice better). */
const GATE_WHY = [
  { e: "💸", t: "Keep it realistic for your money, time and stage of life." },
  { e: "👯", t: "Compare you with people like you, and what they actually picked." },
  { e: "🎯", t: "Skip advice that fits an average person but not you." },
];

const END = "\u0000";

/** Cards and buttons under a bot bubble line up with the bubble, not the avatar (size-7 avatar + gap-2). */
const UNDER_BOT = "ml-9";

/** A Pickbot thread: the conversation so far, then whatever comes next (a profile question, the choice, quick battles, the answer, the crowd). */
export function PickbotThread({ initial }: { initial: ThreadView }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState<{ raw: string; kind: AnswerKind } | null>(null);
  const [nextPicked, setNextPicked] = useState(false);
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const next = await api<ThreadView>(`/api/pickbot/${v.thread.id}`);
    setV(next);
    return next;
  }, [v.thread.id]);

  // Back/forward can restore a cached first render: always load the live thread when it opens or comes back.
  useEffect(() => {
    refresh().catch(() => {});
    const onShow = () => document.visibilityState === "visible" && refresh().catch(() => {});
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = async (path: string, body: unknown = {}) => {
    setBusy(true);
    try {
      await api(`/api/pickbot/${v.thread.id}/${path}`, { body });
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setBusy(false);
  };

  // The answer streams in as soon as the thread is ready for one.
  const answer = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    const kind = v.step.type === "answer" ? v.step.kind : "general";
    setStream({ raw: "", kind });
    try {
      const res = await fetch(`/api/pickbot/${v.thread.id}/answer`, { method: "POST" });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Something went wrong");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let all = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        all += dec.decode(value, { stream: true });
        const raw = all.split(END)[0];
        setStream({ raw, kind });
      }
      const meta = all.includes(END) ? JSON.parse(all.slice(all.indexOf(END) + 1)) : null;
      if (meta?.error) throw new Error(meta.error.message);
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      await refresh().catch(() => {});
    }
    setStream(null);
    started.current = false;
  }, [v.step, v.thread.id, refresh]);

  useEffect(() => {
    if (v.step.type === "answer" && !stream) answer();
  }, [v.step, stream, answer]);

  const streaming = !!stream;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [v.messages.length, v.step.type, streaming]);

  const lastAnswerIdx = v.messages.findLastIndex((m) => m.kind === "answer");
  const lastAnswer = lastAnswerIdx >= 0 ? v.messages[lastAnswerIdx] : null;
  // "Not now" to the better-answer offer after the latest answer (kept in the thread, so it holds after a reload).
  const notNowIdx = v.messages.findLastIndex((m, i) => i > lastAnswerIdx && m.role === "USER" && m.kind === "note" && m.text === "Not now");
  const saidNotNow = lastAnswerIdx >= 0 && notNowIdx > lastAnswerIdx;
  const done = v.step.type === "done";
  const hasResults = v.messages.some((m) => m.kind === "results");
  // The crowd question is settled once it's posted, the box is unticked, or it can't go to the crowd.
  const crowdSettled = !v.crowdAllowed || !!v.crowd || v.thread.state.crowd !== true;

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/ask" className="text-[13px] text-accent">
          ← Pickbot
        </Link>
        <span className="flex items-center gap-3 text-[12px] text-ink/50">
          {v.answersLeft != null && (
            <span>
              {v.answersLeft} free answer{v.answersLeft === 1 ? "" : "s"} left today
            </span>
          )}
          <button
            type="button"
            className="text-ink/50 underline-offset-2 hover:underline"
            onClick={async () => {
              if (!confirm("Delete this question and Pickbot's answers? A crowd battle you posted stays up (it's anonymous).")) return;
              try {
                await api(`/api/pickbot/${v.thread.id}`, { method: "DELETE" });
                window.location.href = "/ask";
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            Delete
          </button>
        </span>
      </div>

      {v.messages.map((m, i) => (
        <Fragment key={m.id}>
          <MessageView
            m={m}
            threadId={v.thread.id}
            latest={i === lastAnswerIdx}
            left={v.progress.left}
            onRetailor={() => post("step", { action: "retailor" })}
            crowd={v.crowd}
            onOutcome={(c) => post("outcome", { chosen: c })}
            busy={busy}
            canTailor={false}
          />
          {/* The crowd box sits right under the latest answer. */}
          {i === lastAnswerIdx && done && !hasResults && v.thread.scope !== "off_topic" && <CrowdBox v={v} busy={busy} onToggle={(on) => post("crowd", { on })} />}
        </Fragment>
      ))}

      {v.step.type === "gate" && v.gate && <Gate v={v} busy={busy} onAnswer={(answer, label) => post("gate", { question: v.gate!.q, answer, label })} />}

      {v.step.type === "battles" && <QuickBattles key={v.step.left} v={v} onDone={refresh} onStop={() => post("step", { action: "stop" })} />}

      {stream && <AnswerView answer={null} raw={stream.raw} kind={stream.kind} streaming />}

      {v.step.type === "off_topic" && (
        <Link href="/ask" className="btn-outline inline-flex">
          Ask something else
        </Link>
      )}

      {v.crowd && !hasResults && (
        <div className={UNDER_BOT}>
          <PushButton />
        </div>
      )}

      {done && lastAnswer?.answer?.kind === "general" && v.progress.left > 0 && !saidNotNow && crowdSettled && (
        <div className="space-y-2" data-testid="pickbot-better">
          <Bot>
            Want more precise answers, fully tailored to <b>YOU</b>? It’s easy and fun! Answer {v.progress.left} more battle{v.progress.left === 1 ? "" : "s"}. I need {v.progress.target}{" "}
            answers to show you my magic.
          </Bot>
          <div className={cn(UNDER_BOT, "space-y-2")}>
            <TasteBar votes={v.progress.votes} target={v.progress.target} />
            <button type="button" className="btn-primary w-full !py-3 text-[16px]" disabled={busy} onClick={() => post("step", { action: "retailor" })}>
              Keep voting
            </button>
            <button type="button" className="block w-full py-1.5 text-center text-[14px] text-ink/60" disabled={busy} onClick={() => post("step", { action: "stop" })}>
              Not now
            </button>
          </div>
        </div>
      )}

      {done && saidNotNow && notNowIdx === v.messages.length - 1 && !nextPicked && (
        <div className="space-y-2" data-testid="pickbot-next">
          <Bot>No problem! What would you like to do next?</Bot>
          <div className={cn(UNDER_BOT, "grid gap-2")}>
            <Link href="/you" className="btn-outline w-full justify-center">
              See my profile
            </Link>
            <Link href="/vote" className="btn-outline w-full justify-center">
              Vote on battles
            </Link>
            <button
              type="button"
              className="btn-outline w-full justify-center"
              onClick={() => {
                setNextPicked(true);
                setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Ask a follow-up"]')?.focus(), 50);
              }}
            >
              Ask Pickbot more
            </button>
          </div>
        </div>
      )}

      {(done || v.step.type === "off_topic") && v.thread.scope !== "off_topic" && (
        <div className="pt-2">
          <AskComposer threadId={v.thread.id} onSent={refresh} placeholder="Ask a follow-up…" />
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}

function Bot({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet text-white" aria-hidden>
        <Sparkles className="size-4" />
      </span>
      <div className="rounded-[16px] rounded-tl-[4px] bg-white px-3.5 py-2.5 text-[15px] leading-snug text-ink shadow-soft">{children}</div>
    </div>
  );
}

function Me({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[16px] rounded-tr-[4px] bg-a px-3.5 py-2.5 text-[15px] leading-snug text-white">{children}</div>
    </div>
  );
}

function MessageView({
  m,
  threadId,
  latest,
  left,
  onRetailor,
  crowd,
  onOutcome,
  busy,
  canTailor,
}: {
  m: Msg;
  threadId: string;
  latest: boolean;
  left: number;
  onRetailor: () => void;
  crowd: ThreadView["crowd"];
  onOutcome: (c: "A" | "B" | "NEITHER") => void;
  busy: boolean;
  canTailor: boolean;
}) {
  if (m.kind === "question")
    return (
      <div className="flex flex-col items-end gap-1.5">
        {m.photos.length > 0 && (
          <div className="flex gap-1.5">
            {m.photos.map((p, i) => (
              <img key={p} src={p} alt={`Your photo ${i + 1}`} className="h-28 w-24 rounded-[12px] object-cover" />
            ))}
          </div>
        )}
        <Me>{m.text}</Me>
      </div>
    );
  if (m.kind === "note") return m.role === "USER" ? <Me>{m.text}</Me> : <Bot>{m.text}</Bot>;
  if (m.kind === "answer" && m.answer) {
    const d = (m.data ?? {}) as { similar?: Similar[]; likeLabel?: string | null };
    return (
      <AnswerView
        answer={m.answer}
        kind={m.answer.kind}
        similar={d.similar ?? []}
        likeLabel={d.likeLabel ?? null}
        messageId={m.id}
        rating={m.rating}
        footer={
          canTailor && m.answer.kind === "general" ? (
            <button type="button" disabled={busy} className="text-[13px] text-accent" onClick={onRetailor}>
              Want this tailored? {left} quick battle{left === 1 ? "" : "s"} →
            </button>
          ) : null
        }
        latest={latest}
      />
    );
  }
  if (m.kind === "draft") return null;
  if (m.kind === "results") {
    const r = m.data as { total: number; votesA: number; votesB: number; labelA: string; labelB: string; like: { a: number; b: number } | null; likeLabel: string | null; reasons: string[]; agreed: boolean | null; line: string };
    return (
      <div className="card space-y-3 px-4 py-4" data-testid="pickbot-results">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink/50">The crowd is in · {r.total} votes</p>
        <Split label="Everyone" a={r.labelA} b={r.labelB} va={r.votesA} vb={r.votesB} />
        {r.like && <Split label={r.likeLabel ?? "People like you"} a={r.labelA} b={r.labelB} va={r.like.a} vb={r.like.b} lime />}
        <p className="text-[15px]">{r.line}</p>
        {r.reasons.length > 0 && (
          <ul className="space-y-1 text-[13px] text-ink/70">
            {r.reasons.map((x) => (
              <li key={x}>“{x}”</li>
            ))}
          </ul>
        )}
        {crowd && !crowd.outcome && (
          <div className="space-y-2 border-t border-ink/10 pt-3">
            <p className="text-[14px] font-medium">Tell us what you picked</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className="chip" onClick={() => onOutcome("A")}>
                {crowd.labelA}
              </button>
              <button type="button" disabled={busy} className="chip" onClick={() => onOutcome("B")}>
                {crowd.labelB}
              </button>
              <button type="button" disabled={busy} className="chip" onClick={() => onOutcome("NEITHER")}>
                Neither
              </button>
            </div>
            <p className="text-[12px] text-ink/50">Closing the loop earns ⚡ and teaches Pickbot whether its advice landed.</p>
          </div>
        )}
      </div>
    );
  }
  void threadId;
  return null;
}

function Split({ label, a, b, va, vb, lime }: { label: string; a: string; b: string; va: number; vb: number; lime?: boolean }) {
  const pa = va + vb ? Math.round((va / (va + vb)) * 100) : 50;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[12px] text-ink/60">
        <span>{label}</span>
        <span className="tabular-nums">{va + vb} votes</span>
      </div>
      {/* Labels sit above the bar, never inside it: long answers wrap here instead of spilling off a thin segment. */}
      <div className="grid grid-cols-2 gap-3 text-[13px] leading-snug">
        <span className="min-w-0 break-words">
          <b className={cn("mr-1 font-display text-[20px] leading-none tabular-nums", lime ? "text-green" : "text-a")}>{pa}%</b>
          <span className="text-ink">{a}</span>
        </span>
        <span className="min-w-0 break-words text-right">
          <b className="mr-1 font-display text-[20px] leading-none tabular-nums text-b">{100 - pa}%</b>
          <span className="text-ink">{b}</span>
        </span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-ink/10">
        {pa > 0 && <span className={cn("block h-full rounded-full transition-[width] duration-700", lime ? "bg-green" : "bg-a")} style={{ width: `${pa}%` }} />}
        {pa < 100 && <span className="block h-full flex-1 rounded-full bg-b" />}
      </div>
    </div>
  );
}

function AnswerView({
  answer,
  raw,
  kind,
  streaming,
  similar = [],
  likeLabel,
  messageId,
  rating,
  footer,
  latest,
}: {
  answer: (Answer & { kind: AnswerKind }) | null;
  raw?: string;
  kind: AnswerKind;
  streaming?: boolean;
  similar?: Similar[];
  likeLabel?: string | null;
  messageId?: string;
  rating?: "UP" | "DOWN" | null;
  footer?: React.ReactNode;
  latest?: boolean;
}) {
  const f = (k: keyof Answer) => (answer ? String(answer[k] ?? "") : partialField(raw ?? "", k));
  const [rated, setRated] = useState(rating ?? null);
  const [note, setNote] = useState("");
  const [askNote, setAskNote] = useState(false);
  const rate = async (r: "UP" | "DOWN", withNote?: string) => {
    setRated(r);
    if (r === "DOWN" && withNote == null) setAskNote(true);
    try {
      await api("/api/pickbot/rate", { body: { messageId, rating: r, ...(withNote ? { note: withNote } : {}) } });
      if (withNote != null) {
        setAskNote(false);
        toast("Thanks, that helps Pickbot get better");
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const conf = f("confidence") as keyof typeof CONFIDENCE_LABEL;
  return (
    <div className="flex items-start gap-2" data-testid="pickbot-answer">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet text-white" aria-hidden>
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-3 rounded-[16px] rounded-tl-[4px] bg-white px-4 py-3.5 shadow-soft">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", kind === "tailored" ? "bg-green-soft text-green" : "bg-surface text-ink/60")}>
            {kind === "tailored" ? "Tailored" : "General"}
          </span>
          {streaming && <Loader2 className="size-3.5 animate-spin text-ink/40" aria-label="Pickbot is answering" />}
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink/50">My pick</p>
          <p className="display text-[26px] leading-tight text-ink">{f("pick") || (streaming ? "…" : "")}</p>
        </div>
        {f("why") && (
          <p className="text-[15px] leading-snug text-ink/85">
            <b className="text-ink">Why it fits you: </b>
            {f("why")}
          </p>
        )}
        {!streaming && similar.length > 0 && (
          <div className="space-y-2 rounded-[12px] bg-surface p-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink/50">How people voted on similar battles</p>
            {similar.map((s) => (
              <Link key={s.slug} href={`/b/${s.slug}`} className="block space-y-1">
                <p className="line-clamp-1 text-[13px] text-ink">{s.title}</p>
                <Split label="Everyone" a={s.a} b={s.b} va={s.votesA} vb={s.votesB} />
                {s.likeA != null && s.likeB != null && s.likeA + s.likeB >= 3 && <Split label={likeLabel ?? "People like you"} a={s.a} b={s.b} va={s.likeA} vb={s.likeB} lime />}
              </Link>
            ))}
          </div>
        )}
        {f("crowd") && <p className="text-[14px] text-ink/75">{f("crowd")}</p>}
        {(f("flip") || (!streaming && conf)) && (
          <p className="text-[13px] text-ink/70">
            {CONFIDENCE_LABEL[conf] && <b className="text-ink">Confidence: {CONFIDENCE_LABEL[conf].toLowerCase()}. </b>}
            {f("flip")}
          </p>
        )}
        {f("care") && <p className="rounded-[10px] bg-amber-soft px-3 py-2 text-[13px] text-amber">{f("care")}</p>}
        {!streaming && messageId && (
          <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-2.5">
            <button type="button" aria-label="Helpful" aria-pressed={rated === "UP"} className={cn("rounded-full p-2", rated === "UP" ? "bg-green-soft text-green" : "text-ink/50")} onClick={() => rate("UP")}>
              <ThumbsUp className="size-4" />
            </button>
            <button type="button" aria-label="Not helpful" aria-pressed={rated === "DOWN"} className={cn("rounded-full p-2", rated === "DOWN" ? "bg-b-soft text-b" : "text-ink/50")} onClick={() => rate("DOWN")}>
              <ThumbsDown className="size-4" />
            </button>
            {latest && footer}
          </div>
        )}
        {askNote && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              rate("DOWN", note);
            }}
          >
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="What was off? (optional)" aria-label="What was off?" className="input flex-1 text-[14px]" />
            <button className="btn-outline !py-1.5 text-[13px]">Send</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Gate({ v, busy, onAnswer }: { v: ThreadView; busy: boolean; onAnswer: (answer: string, label: string) => void }) {
  const g = v.gate!;
  // The intro line shows before the first card asked in this thread (earlier cards may already be answered).
  const first = !v.messages.some((m) => m.kind === "note" && m.role === "BOT" && (m.data as { gate?: string } | null)?.gate);
  const step = v.step as { index: number; total: number };
  // Shuffled after mount (same order on the server and the first client render, then mixed).
  const [opts, setOpts] = useState(g.options);
  useEffect(() => setOpts(cardOrder(g.options)), [g.options]);
  const [zip, setZip] = useState("");
  const left = step.total - step.index + 1;
  return (
    <div className="space-y-2" data-testid="pickbot-gate">
      {step.index <= 1 || first ? (
        <Bot>
          <p>
            Before I answer, I need to know you a little: <b>only {left} quick tap{left === 1 ? "" : "s"}</b>.
          </p>
          <p className="mt-2">
            Here’s why it matters. The right call for a 24-year-old renter who just started dating is often the wrong one for a 38-year-old parent with a
            mortgage. Each answer helps me:
          </p>
          <ul className="mt-2 space-y-1.5">
            {GATE_WHY.map((w) => (
              <li key={w.t} className="flex items-start gap-2">
                <span className="text-[16px] leading-[1.2]" aria-hidden>
                  {w.e}
                </span>
                <span>{w.t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink/60">
            <Lock className="size-3.5 shrink-0" aria-hidden /> Ranges only. Never shown on your public profile.
          </p>
        </Bot>
      ) : null}
      <div className={cn(UNDER_BOT, "card space-y-3 px-4 py-4")}>
        <div className="flex items-center justify-between">
          <p className="display text-[22px] text-ink">{g.title}</p>
          <span className="text-[12px] text-ink/50">
            {step.index} of {step.total}
          </span>
        </div>
        {g.kind === "zip" ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (zip.trim()) onAnswer(zip.trim(), zip.trim());
            }}
          >
            <input value={zip} onChange={(e) => setZip(e.target.value.slice(0, 10))} inputMode="numeric" placeholder="ZIP code" aria-label="ZIP code" className="input flex-1" />
            <button className="btn-primary" disabled={busy || !zip.trim()}>
              Save
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {opts.map((o, i) => (
              <button
                key={o.id}
                type="button"
                disabled={busy}
                className={cn("qtile min-h-[52px] px-3 py-3 text-[15px]", o.id === PREFER_NOT ? "qtile-quiet" : TILE[i % TILE.length])}
                onClick={() => onAnswer(o.id, o.label)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <p className="why-ask">
          <span className="why-ask-tag">Why I ask</span>
          <span>{WHY[g.q]}</span>
        </p>
        <p className="flex items-center gap-1 text-[12px] text-ink/45">
          <Lock className="size-3" /> Never shown on your public profile
        </p>
      </div>
    </div>
  );
}

function QuickBattles({ v, onDone, onStop }: { v: ThreadView; onDone: () => void; onStop: () => void }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState((v.step as { left: number }).left);
  const [votes, setVotes] = useState(v.progress.votes);
  const [shown, setShown] = useState<{ a: number; b: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const b = v.quick[i];
  useEffect(() => {
    if (!b) onDone();
  }, [b, onDone]);
  if (!b) return <Loader2 className="mx-auto size-5 animate-spin text-ink/40" />;
  const vote = async (side: "A" | "B") => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ results: { a: number; b: number } }>(`/api/battles/${b.slug}/vote`, { body: { side, source: "pickbot" } });
      setShown(r.results);
      setLeft((n) => Math.max(0, n - 1));
      setVotes((n) => n + 1);
      setTimeout(() => {
        setShown(null);
        setBusy(false);
        if (left - 1 <= 0) onDone();
        else setI((x) => x + 1);
      }, 900);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
      setI((x) => x + 1);
    }
  };
  return (
    <div className={cn(UNDER_BOT, "space-y-2")} data-testid="pickbot-battles">
      <TasteBar votes={votes} target={v.progress.target} />
      <div className="card space-y-3 px-4 py-4">
        <p className="text-[16px] font-medium leading-snug text-ink">{b.title}</p>
        <div className="grid grid-cols-2 gap-2">
          {(["A", "B"] as const).map((s) => {
            const img = s === "A" ? b.imageA : b.imageB;
            const label = s === "A" ? b.labelA : b.labelB;
            const p = shown ? (s === "A" ? pct(shown.a, shown.b).a : pct(shown.a, shown.b).b) : null;
            return (
              <button
                key={s}
                type="button"
                disabled={busy}
                aria-label={`Vote for ${label}`}
                onClick={() => vote(s)}
                className={cn("overflow-hidden rounded-[12px] text-left text-[14px] font-medium", s === "A" ? "bg-a-soft text-a" : "bg-b-soft text-b")}
              >
                {img && <img src={img} alt="" className="h-28 w-full object-cover" />}
                <span className="flex items-center justify-between px-3 py-2.5">
                  <span>{label}</span>
                  {p != null && <span className="tabular-nums">{p}%</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="flex items-center justify-between text-[12px] text-ink/50">
        <span>Each vote also counts in the Vote deck.</span>
        <button type="button" className="text-accent" onClick={onStop}>
          Not now
        </button>
      </p>
    </div>
  );
}

/**
 * "Get answers from the crowd" after the answer (Alex, Nov 27 2026): ticked by default, so the question is already
 * posted anonymously; untick to take it down and keep it private, tick to send it.
 */
function CrowdBox({ v, busy, onToggle }: { v: ThreadView; busy: boolean; onToggle: (on: boolean) => Promise<void> }) {
  // The tick shows at once; the thread catches up when the server answers.
  const [tapped, setTapped] = useState<boolean | null>(null);
  if (!v.crowdAllowed)
    return (
      <p className={cn(UNDER_BOT, "flex items-center gap-1.5 text-[13px] text-ink/60")}>
        <Lock className="size-3.5 shrink-0" aria-hidden /> This one stays private, so it doesn’t go to the crowd.
      </p>
    );
  const on = tapped ?? (!!v.crowd || v.thread.state.crowd === true);
  const c = tapped === false ? null : v.crowd;
  return (
    <div className={cn(UNDER_BOT, "card space-y-2 px-4 py-3")} data-testid="pickbot-crowd">
      <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold text-ink">
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={async (e) => {
            setTapped(e.target.checked);
            await onToggle(e.target.checked);
            setTapped(null);
          }}
          className="size-5 shrink-0 accent-green"
          aria-label="Let the crowd decide too"
        />
        Let the crowd decide too
        {busy && <Loader2 className="size-4 animate-spin text-ink/40" aria-hidden />}
      </label>
      {c ? (
        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-ink/70">
          <span>
            Posted anonymously as “Asked via Pickbot” · {c.votesA + c.votesB} vote{c.votesA + c.votesB === 1 ? "" : "s"} so far ·{" "}
            {c.status === "OPEN" ? `closes ${new Date(c.deadline).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "closed"}
          </span>
          <Link href={`/b/${c.slug}`} className="font-semibold text-accent">
            See it →
          </Link>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[13px] text-ink/60">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          {on ? "Sending it to the crowd anonymously…" : "Private. Only you can see this question."}
        </p>
      )}
    </div>
  );
}

/** Battles answered toward the full personality test (all votes ever, not just this chat). */
function TasteBar({ votes, target }: { votes: number; target: number }) {
  const n = Math.min(votes, target);
  const left = Math.max(0, target - votes);
  return (
    <div className="card space-y-2 px-4 py-3" data-testid="pickbot-taste-bar">
      <div className="flex items-baseline justify-between">
        <b className="text-[14px] text-ink">Personality test</b>
        <span className="text-[13px] tabular-nums text-ink/70">
          {n} / {target} battles
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={target} aria-label="Battles answered">
        <div className="h-full rounded-full bg-green transition-[width] duration-500" style={{ width: `${(n / target) * 100}%` }} />
      </div>
      <p className="text-[12px] text-ink/55">{left ? `${left} more for your tailored answer` : "Done! Getting your tailored answer…"}</p>
    </div>
  );
}
