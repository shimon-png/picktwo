"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { api, setPP, toast } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";

export type LoopItem = { id: string; slug: string; title: string; deadline: string; votesA: number; votesB: number; labelA: string; labelB: string };

export function OpenLoopsList({ items }: { items: LoopItem[] }) {
  const [done, setDone] = useState<string[]>([]);
  const visible = items.filter((i) => !done.includes(i.id));
  if (!visible.length) return <p className="text-sm text-zinc-500">All loops closed — nice work! 🎉</p>;
  return (
    <ul className="space-y-2">
      {visible.map((i) => (
        <QuickClose key={i.id} item={i} onDone={() => setDone((d) => [...d, i.id])} />
      ))}
    </ul>
  );
}

function QuickClose({ item, onDone }: { item: LoopItem; onDone: () => void }) {
  const [chosen, setChosen] = useState<"A" | "B" | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(c: "A" | "B" | "NEITHER", thumb: "UP" | "DOWN" | null) {
    setBusy(true);
    try {
      const r = await api<{ points: number }>(`/api/battles/${item.slug}/outcome`, { body: { chosen: c, thumb } });
      toast(r.points ? `+${r.points} ⚡ Loop closed` : "Loop closed", "pp");
      const me = await api<{ ppBalance: number }>("/api/me/priority").catch(() => null);
      setPP(me?.ppBalance);
      onDone();
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }
  const total = item.votesA + item.votesB;
  return (
    <li className="card space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/b/${item.slug}`} className="font-semibold hover:underline">
          {item.title}
        </Link>
        <span className="shrink-0 text-xs text-zinc-500">closed {timeAgo(item.deadline)}</span>
      </div>
      <div className="text-xs text-zinc-500">
        {total} votes · {total ? Math.round((item.votesA / total) * 100) : 0}% {item.labelA}
      </div>
      {!chosen ? (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-sm font-medium">I picked:</span>
          <button disabled={busy} className="chip border-a/40 text-a" onClick={() => setChosen("A")}>
            {item.labelA}
          </button>
          <button disabled={busy} className="chip border-b/40 text-b" onClick={() => setChosen("B")}>
            {item.labelB}
          </button>
          <button disabled={busy} className="chip" onClick={() => submit("NEITHER", null)}>
            Neither
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">How did {chosen === "A" ? item.labelA : item.labelB} go?</span>
          <button disabled={busy} className={cn("chip")} onClick={() => submit(chosen, "UP")} aria-label="It worked out">
            <ThumbsUp className="size-4 text-ok" /> Great
          </button>
          <button disabled={busy} className="chip" onClick={() => submit(chosen, "DOWN")} aria-label="Not great">
            <ThumbsDown className="size-4" /> Not great
          </button>
          <button className="text-xs text-zinc-500 underline" onClick={() => setChosen(null)}>
            back
          </button>
        </div>
      )}
    </li>
  );
}
