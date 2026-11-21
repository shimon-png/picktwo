"use client";
import { useState } from "react";
import { Flag, X } from "lucide-react";
import { api, toast } from "@/lib/client";
import { REPORT_REASONS } from "@/server/services/safety";
import { cn } from "@/lib/utils";

/**
 * Small flag button that sits on a battle photo. Opens a sheet of reasons; the flag goes into the
 * admin review queue and enough flags hide the battle automatically (`submitReport`).
 */
export function PhotoFlag({ battleId, side, label, onFlagged, className }: { battleId: string; side: "A" | "B"; label: string; onFlagged?: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function send(reason: string) {
    setBusy(true);
    try {
      const r = await api<{ hidden?: boolean }>("/api/reports", { body: { targetType: "BATTLE", targetId: battleId, reason, details: `photo ${side}: ${label}`.slice(0, 500) } });
      toast(r.hidden ? "Thanks. It's hidden while our team reviews it." : "Thanks for flagging. Our team will review it.", "ok");
      setOpen(false);
      onFlagged?.();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        data-nodrag
        aria-label={`Flag photo ${side}`}
        title="Flag this photo"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn("absolute right-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/55", className)}
      >
        <Flag className="size-3.5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !busy && setOpen(false)} data-nodrag>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Flag this photo"
            data-flag-sheet
            className="w-full max-w-md rounded-t-[20px] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lift sm:rounded-[20px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-[15px] font-medium">What’s wrong with this photo?</h2>
              <button type="button" className="rounded-full p-1 hover:bg-zinc-100" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-zinc-500">Flags are private. Our team reviews every one.</p>
            <div className="mt-3 space-y-1">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={busy}
                  onClick={() => send(r.id)}
                  className={cn("block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-zinc-100", r.severe && "font-medium")}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
