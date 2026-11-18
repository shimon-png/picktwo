"use client";
import { useState } from "react";
import { Flag } from "lucide-react";
import { api, toast } from "@/lib/client";

const REASONS = [
  { id: "minor_safety", label: "Child safety concern" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "harassment", label: "Harassment or hate" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Something else" },
] as const;

export function ReportButton({ targetType, targetId, small }: { targetType: "BATTLE" | "REASON" | "USER"; targetId: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  async function send(reason: string) {
    try {
      await api("/api/reports", { body: { targetType, targetId, reason } });
      toast("Thanks — our team will review it");
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setOpen(false);
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={small ? "rounded-full p-1 hover:bg-zinc-100" : "btn-ghost !px-3 !py-1.5 text-zinc-500"}
        aria-label="Report"
        aria-expanded={open}
      >
        <Flag className={small ? "size-3.5" : "size-4"} /> {!small && "Report"}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-56 rounded-[14px] bg-white p-1.5 shadow-lift" role="menu">
          {REASONS.map((r) => (
            <button key={r.id} role="menuitem" onClick={() => send(r.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100">
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
