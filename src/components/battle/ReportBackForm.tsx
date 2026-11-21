"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ImagePlus, ThumbsDown, ThumbsUp, X, Zap } from "lucide-react";
import confetti from "canvas-confetti";
import { api, setPP, toast, uploadImage } from "@/lib/client";
import { cn } from "@/lib/utils";
import { OptionFace, type OptionData } from "./OptionFace";

type Chosen = "A" | "B" | "NEITHER";

export function ReportBackForm(props: {
  slug: string;
  title: string;
  A: OptionData;
  B: OptionData;
  votes: { a: number; b: number };
  isOpen: boolean;
  eligible: boolean;
  minVotes: number;
  initial: { chosen: Chosen | null; thumb: "UP" | "DOWN" | null; note: string };
  editing: boolean;
  fastEligible: boolean;
  rewards: { loop: number; fast: number; note: number; noteMin: number };
}) {
  const [chosen, setChosen] = useState<Chosen | null>(props.initial.chosen);
  const [thumb, setThumb] = useState<"UP" | "DOWN" | null>(props.initial.thumb);
  const [note, setNote] = useState(props.initial.note);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const total = props.votes.a + props.votes.b;
  const leader = props.votes.a >= props.votes.b ? "A" : "B";
  const leaderPct = total ? Math.round(((leader === "A" ? props.votes.a : props.votes.b) / total) * 100) : 0;
  const needsThumb = chosen !== "NEITHER";
  const canSubmit = !!chosen && (!needsThumb || !!thumb) && !busy && (!props.isOpen || props.eligible);
  const noteBonus = note.trim().length >= props.rewards.noteMin ? props.rewards.note : 0;
  const reward = props.eligible && !props.editing ? props.rewards.loop + (props.fastEligible ? props.rewards.fast : 0) + noteBonus : 0;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const r = await api<{ points: number }>(`/api/battles/${props.slug}/outcome`, {
        body: { chosen, thumb: chosen === "NEITHER" ? null : thumb, note, photoUrl: photo ?? undefined },
      });
      if (r.points > 0) {
        confetti({ particleCount: 110, spread: 80, origin: { y: 0.7 }, colors: ["#2BD2FF", "#FF3CAC", "#C6FF3D", "#7B4FE0"] });
        toast(`+${r.points} Loop closed — thank you!`, "pp");
        const me = await api<{ ppBalance: number }>("/api/me/priority").catch(() => null);
        setPP(me?.ppBalance);
      } else toast(props.editing ? "Outcome updated" : "Thanks for sharing the outcome!", "ok");
      setTimeout(() => router.push(props.editing ? `/b/${props.slug}` : "/you"), 900);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    try {
      setPhoto(await uploadImage(f));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const tile = (s: Chosen, label: string, face: React.ReactNode, narrow?: boolean) => (
    <button
      key={s}
      type="button"
      onClick={() => setChosen(s)}
      aria-pressed={chosen === s}
      aria-label={s === "NEITHER" ? "Neither" : `Picked ${label}`}
      className={cn("relative h-[120px] min-w-0", narrow ? "w-[78px] shrink-0" : "flex-1")}
    >
      {face}
      {chosen === s && (
        <span className="absolute right-2 top-2 z-30 flex size-5 items-center justify-center rounded-full bg-accent text-white" aria-hidden>
          <Check className="size-3.5" />
        </span>
      )}
    </button>
  );

  return (
    <div className="-mx-4 -mt-2 flex min-h-dvh flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="-mx-2 flex h-12 shrink-0 items-center gap-1">
        <Link href={`/b/${props.slug}`} className="rounded-lg p-2 hover:bg-surface" aria-label="Back">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-[15px]">Close the loop</span>
      </div>

      <h1 className="mt-1 text-[22px] leading-snug">{props.title}</h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        {total > 0
          ? `Voters said ${leader === "A" ? props.A.label : props.B.label} · ${leaderPct}% of ${total} vote${total === 1 ? "" : "s"}`
          : "No votes yet"}
      </p>

      {props.isOpen && !props.eligible && (
        <p className="card mt-4 p-3.5 text-[13px] text-zinc-600">Voting is still open. Once you have {props.minVotes} votes you can share your decision early.</p>
      )}

      <section className="mt-6">
        <h2 className="mb-2.5 text-[22px]">Which did you pick?</h2>
        <div className="flex gap-2">
          {tile("A", props.A.label, <OptionFace side="A" label={props.A.label} image={props.A.imageUrl || props.A.urlImage} ring={chosen === "A"} />)}
          {tile("B", props.B.label, <OptionFace side="B" label={props.B.label} image={props.B.imageUrl || props.B.urlImage} ring={chosen === "B"} />)}
          {tile(
            "NEITHER",
            "Neither",
            <span className={cn("flex h-full w-full items-end rounded-lg bg-surface p-2.5 text-[13px]", chosen === "NEITHER" && "ring-2 ring-inset ring-accent")}>Neither</span>,
            true,
          )}
        </div>
      </section>

      {needsThumb && (
        <section className="mt-6">
          <h2 className="mb-2.5 text-[22px]">How did it go?</h2>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["UP", ThumbsUp, "Went well"],
                ["DOWN", ThumbsDown, "Not great"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setThumb(id)}
                aria-pressed={thumb === id}
                className={cn("btn !py-3 shadow-ring", thumb === id ? "bg-accent-900 text-accent ring-1 ring-accent" : "bg-white text-ink")}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <label className="mb-2 flex items-center gap-1 text-[13px] text-zinc-600" htmlFor="note">
          Anything to add?
          <span className="text-accent">
            +{props.rewards.note} <Zap className="inline size-3 fill-pp text-pp" aria-hidden /> for {props.rewards.noteMin}+ characters
          </span>
        </label>
        <textarea id="note" className="input" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="She played with it all weekend!" />
        <div className="mt-2 flex items-center gap-3">
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Your after photo" className="size-14 rounded-lg object-cover" />
              <button className="absolute -right-2 -top-2 rounded-full bg-ink p-0.5 text-page" onClick={() => setPhoto(null)} aria-label="Remove photo">
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="btn-ghost cursor-pointer !px-2 !py-1 text-[13px]">
              <ImagePlus className="size-4" aria-hidden /> Add an “after” photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          )}
          <span className="text-xs text-zinc-400">No children’s faces, please.</span>
        </div>
      </section>

      <div className="flex-1" />
      <button className="btn-primary mt-6 w-full py-3" disabled={!canSubmit} onClick={submit}>
        {busy ? (
          "Saving…"
        ) : props.editing ? (
          "Update outcome"
        ) : (
          <>
            Share the outcome{reward > 0 && <> · +{reward}</>} <Zap className="size-4 fill-white" aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}
