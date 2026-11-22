"use client";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import type { Toast } from "@/lib/client";
import { cn } from "@/lib/utils";

/** Top-centre toasts. ⚡ toasts ("+1 for voting") are short-lived (1.6s); others stay a bit longer. */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      setItems((xs) => [...xs.slice(-2), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.tone === "pp" ? 1600 : 3200);
    };
    window.addEventListener("pt:toast", on);
    return () => window.removeEventListener("pt:toast", on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[4.6rem] z-[60] flex flex-col items-center gap-2 px-4 pt-[env(safe-area-inset-top)]">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "animate-toast pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm shadow-card",
            t.tone === "error" ? "bg-b text-white" : "bg-accent-900 text-accent-100",
          )}
        >
          {t.tone === "pp" && <Zap className="size-4 fill-pp text-pp" aria-hidden />}
          {t.tone === "pp" ? t.text.replace(/\s*⚡\s*/g, " ").trim() : t.text}
        </div>
      ))}
    </div>
  );
}
