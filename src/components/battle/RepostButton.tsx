"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { api, toast } from "@/lib/client";
import { cn } from "@/lib/utils";

/** One tap: posts a finished battle again as a new 5-day-max battle and opens it. */
export function RepostButton({ slug, className }: { slug: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function repost() {
    setBusy(true);
    try {
      const r = await api<{ slug: string; inReview: boolean }>(`/api/battles/${slug}/repost`, { method: "POST" });
      toast(r.inReview ? "Reposted. It's being checked before it goes live." : "Reposted!", "ok");
      router.push(`/b/${r.slug}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={repost}
      disabled={busy}
      className={cn("tag shrink-0 bg-surface text-ink disabled:opacity-50", className)}
      aria-label="Repost this battle"
    >
      <RotateCcw className="size-3" aria-hidden /> {busy ? "Posting…" : "Repost"}
    </button>
  );
}
