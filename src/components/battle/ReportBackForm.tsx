"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp, ImagePlus, X } from "lucide-react";
import confetti from "canvas-confetti";
import { api, setPP, toast, uploadImage } from "@/lib/client";
import { cn } from "@/lib/utils";
import { OptionTile, type OptionData } from "./OptionTile";

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
  rewards: { loop: number; fast: number; note: number; noteMin: number };
}) {
  const [chosen, setChosen] = useState<Chosen | null>(props.initial.chosen);
  const [thumb, setThumb] = useState<"UP" | "DOWN" | null>(props.initial.thumb);
  const [note, setNote] = useState(props.initial.note);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const total = props.votes.a + props.votes.b;
  const canSubmit = !!chosen && (chosen === "NEITHER" || !!thumb) && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const r = await api<{ points: number }>(`/api/battles/${props.slug}/outcome`, { body: { chosen, thumb: chosen === "NEITHER" ? null : thumb, note, photoUrl: photo ?? undefined } });
      if (r.points > 0) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ["#5B5BD6", "#F2665E", "#F5A524"] });
        toast(`+${r.points} ⚡ Loop closed — thank you!`, "pp");
        const me = await api<{ ppBalance: number }>("/api/me/priority").catch(() => null);
        setPP(me?.ppBalance);
      } else toast(props.editing ? "Updated" : "Thanks for reporting back!", "ok");
      setTimeout(() => router.push(`/b/${props.slug}`), 900);
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

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-zinc-500">Close the loop</p>
        <h1 className="font-display text-2xl font-extrabold">{props.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {total} vote{total === 1 ? "" : "s"} · {total ? Math.round((props.votes.a / total) * 100) : 0}% {props.A.label} ·{" "}
          {total ? Math.round((props.votes.b / total) * 100) : 0}% {props.B.label}
        </p>
      </header>

      {props.isOpen && !props.eligible && (
        <div className="card p-4 text-sm">Voting is still open. Once you have {props.minVotes} votes you can report your decision early.</div>
      )}

      <section>
        <h2 className="label text-base">1. Which did you choose?</h2>
        <div className="flex gap-3">
          {(["A", "B"] as const).map((s) => (
            <OptionTile key={s} option={s === "A" ? props.A : props.B} selected={chosen === s} onClick={() => setChosen(s)} compact />
          ))}
        </div>
        <button className={cn("chip mt-3", chosen === "NEITHER" && "chip-on")} onClick={() => setChosen("NEITHER")} aria-pressed={chosen === "NEITHER"}>
          Neither
        </button>
      </section>

      {chosen && chosen !== "NEITHER" && (
        <section>
          <h2 className="label text-base">2. How did it go?</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setThumb("UP")}
              aria-pressed={thumb === "UP"}
              className={cn("card flex flex-1 flex-col items-center gap-1 p-4 text-sm font-semibold", thumb === "UP" && "border-ok bg-ok/10 ring-2 ring-ok/30")}
            >
              <ThumbsUp className={cn("size-8", thumb === "UP" ? "text-ok" : "text-zinc-400")} /> It worked out
            </button>
            <button
              onClick={() => setThumb("DOWN")}
              aria-pressed={thumb === "DOWN"}
              className={cn("card flex flex-1 flex-col items-center gap-1 p-4 text-sm font-semibold", thumb === "DOWN" && "border-zinc-900 bg-zinc-100 ring-2 ring-zinc-900/20 dark:border-white dark:bg-zinc-800")}
            >
              <ThumbsDown className={cn("size-8", thumb === "DOWN" ? "text-zinc-900 dark:text-white" : "text-zinc-400")} /> Not great
            </button>
          </div>
        </section>
      )}

      <section>
        <label className="label text-base" htmlFor="note">
          {chosen === "NEITHER" ? "2." : "3."} Anything to add? <span className="font-normal text-zinc-400">(optional, +{props.rewards.note} ⚡ for {props.rewards.noteMin}+ characters)</span>
        </label>
        <textarea id="note" className="input" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="She played with it all weekend!" />
        <div className="mt-2 flex items-center gap-3">
          {photo ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Your after photo" className="size-16 rounded-xl object-cover" />
              <button className="absolute -right-2 -top-2 rounded-full bg-zinc-900 p-0.5 text-white" onClick={() => setPhoto(null)} aria-label="Remove photo">
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="btn-ghost cursor-pointer !px-3 !py-1.5">
              <ImagePlus className="size-4" /> Add an “after” photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          )}
          <span className="text-xs text-zinc-400">Please don’t include children’s faces.</span>
        </div>
      </section>

      {!props.editing && props.eligible && (
        <div className="rounded-2xl bg-pp-soft p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          ⚡ You’ll earn <b>+{props.rewards.loop}</b> priority, <b>+{props.rewards.fast}</b> more if you report within 48h of the deadline. Voters who called it earn points too.
        </div>
      )}

      <button className="btn-primary w-full py-3 text-base" disabled={!canSubmit || (props.isOpen && !props.eligible)} onClick={submit}>
        {busy ? "Saving…" : props.editing ? "Update" : "Close the loop"}
      </button>
    </div>
  );
}
