"use client";
import { useEffect, useState } from "react";
import type { Toast } from "@/lib/client";
import { cn } from "@/lib/utils";

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      setItems((xs) => [...xs.slice(-2), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3200);
    };
    window.addEventListener("pt:toast", on);
    return () => window.removeEventListener("pt:toast", on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-8">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "animate-pop pointer-events-auto rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg",
            t.tone === "pp" && "bg-pp text-zinc-900",
            t.tone === "error" && "bg-red-600 text-white",
            t.tone === "ok" && "bg-ok text-white",
            (!t.tone || t.tone === "default") && "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
