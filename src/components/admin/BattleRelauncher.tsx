"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, toast } from "@/lib/client";
import { timeAgo, timeLeft } from "@/lib/utils";

type Row = {
  id: string;
  slug: string;
  title: string;
  deadline: string;
  createdAt: string;
  votes: number;
  authorHandle: string | null;
  live: boolean;
  decided: boolean;
  canRelaunch: boolean;
};

export function BattleRelauncher({ rows, relaunchableEnded, maxHours }: { rows: Row[]; relaunchableEnded: number; maxHours: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [hours, setHours] = useState(maxHours);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const selectable = useMemo(() => rows.filter((r) => r.canRelaunch), [rows]);
  const allPicked = selectable.length > 0 && selectable.every((r) => picked.has(r.id));
  const dayOptions = [1, 2, 3, 4, 5, 7, 14, 30].map((d) => d * 24).filter((h) => h <= maxHours);
  if (!dayOptions.includes(maxHours)) dayOptions.push(maxHours);

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function relaunch(body: { ids?: string[]; allEnded?: boolean }) {
    setBusy(true);
    try {
      const r = await api<{ relaunched: number; hours: number; skipped: number }>("/api/admin/battles", { body: { ...body, hours } });
      toast(`Relaunched ${r.relaunched} battle${r.relaunched === 1 ? "" : "s"} for ${Math.round(r.hours / 24) || 1} day${r.hours > 24 ? "s" : ""}${r.skipped ? ` (${r.skipped} skipped)` : ""}`);
      setPicked(new Set());
      setConfirmAll(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Run for</span>
          <select className="input !w-auto !py-1 text-sm" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {dayOptions.map((h) => (
              <option key={h} value={h}>
                {h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} hours`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {confirmAll ? (
            <>
              <button className="btn-primary" disabled={busy} onClick={() => relaunch({ allEnded: true })}>
                Yes, relaunch all {relaunchableEnded}
              </button>
              <button className="chip" disabled={busy} onClick={() => setConfirmAll(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn-primary" disabled={busy || relaunchableEnded === 0} onClick={() => setConfirmAll(true)}>
              Relaunch all ended ({relaunchableEnded})
            </button>
          )}
          <button className="chip" disabled={busy || picked.size === 0} onClick={() => relaunch({ ids: [...picked] })}>
            Relaunch selected ({picked.size})
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Relaunching puts a battle back in the Vote deck with a fresh deadline. Votes so far are kept, and people who already
          voted won&apos;t see it again. Battles whose poster already reported the final pick stay closed.
        </p>
      </section>

      {!rows.length ? (
        <p className="text-zinc-500">Nothing here.</p>
      ) : (
        <ul className="card divide-y divide-zinc-100 overflow-hidden">
          <li className="flex items-center gap-3 px-3 py-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={allPicked}
              disabled={!selectable.length}
              onChange={() => setPicked(allPicked ? new Set() : new Set(selectable.map((r) => r.id)))}
            />
            <span>Select all shown ({selectable.length})</span>
          </li>
          {rows.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${r.canRelaunch ? "" : "opacity-60"}`}>
              <input type="checkbox" checked={picked.has(r.id)} disabled={!r.canRelaunch} onChange={() => toggle(r.id)} />
              <div className="min-w-0 flex-1">
                <Link href={`/b/${r.slug}`} className="block truncate font-medium">
                  {r.title}
                </Link>
                <div className="text-xs text-zinc-500">
                  {r.authorHandle ? `@${r.authorHandle} · ` : ""}
                  {r.votes} vote{r.votes === 1 ? "" : "s"} · {r.live ? timeLeft(r.deadline) : `ended ${timeAgo(r.deadline)}`}
                  {r.decided && " · final pick reported"}
                </div>
              </div>
              {r.live && <span className="rounded-full bg-green-soft px-2 py-0.5 text-[11px] text-green">live</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
