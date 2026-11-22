"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "@/lib/client";
import { cn } from "@/lib/utils";

/** Follow / unfollow. `followsMe` turns "Follow" into "Follow back" and "Following" into "Friends" (mutual follows). */
export function FollowButton({ userId, initial, followsMe = false, small = false }: { userId: string; initial: boolean; followsMe?: boolean; small?: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function click() {
    setBusy(true);
    try {
      await api(`/api/follow/${userId}`, { method: on ? "DELETE" : "POST" });
      setOn(!on);
      if (!on && followsMe) toast("You're friends now 🎉", "ok");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  const label = on ? (followsMe ? "Friends" : "Following") : followsMe ? "Follow back" : "Follow";
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={on}
      className={cn(on ? "btn-outline" : "btn-primary", small && "!px-3.5 !py-1.5 text-[13px]", "relative z-10 shrink-0")}
      onClick={click}
    >
      {label}
    </button>
  );
}
