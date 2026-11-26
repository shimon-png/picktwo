"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "@/lib/client";
import { timeAgo } from "@/lib/utils";
import type { SeedState } from "@/lib/auto-seed";

export type AutoSeedView = {
  on: boolean;
  rank: number;
  at: number;
  count: number;
  photoPct: number;
  cooldownHours: number;
  writer: boolean;
  photos: boolean;
  totalAuto: number;
  openAuto: number;
  state: SeedState;
};

/** /admin/battles: auto-seeding status (services/auto-seed.ts) with "Check now" and "Write a batch now". */
export function AutoSeedPanel({ s }: { s: AutoSeedView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"check" | "force" | null>(null);
  const c = s.state.lastCheck;
  const b = s.state.batch;

  async function run(action: "check" | "force") {
    setBusy(action);
    try {
      const r = await api<{ result: { wrote: number; photos: number; note: string } }>("/api/admin/auto-seed", { body: { action } });
      toast(r.result.wrote ? `Wrote ${r.result.wrote} battles (${r.result.photos} with photos)` : r.result.note);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[22px]">Auto-seeding</h2>
        <span className={`chip !py-0.5 text-xs ${s.on ? "chip-on" : ""}`}>{s.on ? "On" : "Off"}</span>
        {!s.writer && <span className="text-xs text-pink">Needs ANTHROPIC_API_KEY</span>}
        {!s.photos && <span className="text-xs text-pink">No PEXELS_API_KEY: photo battles are written as text</span>}
      </div>
      <p className="text-zinc-500">
        When the #{s.rank} voter of the last 7 days has {s.at} or fewer battles left, write {s.count} more ({s.photoPct}% photos), at most once every {s.cooldownHours}h. Real people&apos;s battles always come first in the deck. Settings: economy <code>autoSeed*</code>.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <div className="text-xs text-zinc-500">Battles left for #{c?.rank || s.rank}</div>
          <div className="text-xl font-medium">{c?.remaining ?? "–"}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Voters this week</div>
          <div className="text-xl font-medium">{c?.voters ?? "–"}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Auto battles live / all</div>
          <div className="text-xl font-medium">
            {s.openAuto} / {s.totalAuto}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Last batch</div>
          <div className="text-xl font-medium">{s.state.lastFinishedAt ? timeAgo(new Date(s.state.lastFinishedAt)) : "never"}</div>
        </div>
      </div>
      {c && (
        <p className="text-xs text-zinc-500">
          Last check {timeAgo(new Date(c.at))}: {c.note}
        </p>
      )}
      {b && (
        <p className="text-xs">
          Writing batch {b.id}: {b.made}/{b.target} ({b.photos}/{b.photoTarget} photo). Continues each hour until done.
        </p>
      )}
      {s.state.lastError && <p className="text-xs text-pink">Last error: {s.state.lastError}</p>}
      {s.state.history.length > 0 && (
        <ul className="text-xs text-zinc-500">
          {s.state.history.slice(0, 5).map((h) => (
            <li key={h.id}>
              {h.id}: {h.made} battles, {h.photos} with photos, {timeAgo(new Date(h.at))}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn-outline !py-1 text-xs" disabled={!!busy} onClick={() => run("check")}>
          {busy === "check" ? "Checking…" : "Check now"}
        </button>
        <button className="btn-outline !py-1 text-xs" disabled={!!busy || !s.writer} onClick={() => run("force")}>
          {busy === "force" ? "Writing (up to 4 min)…" : `Write a batch now`}
        </button>
      </div>
    </section>
  );
}
