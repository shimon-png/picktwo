"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "@/lib/client";

export function FollowButton({ userId, initial }: { userId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const router = useRouter();
  async function click() {
    try {
      await api(`/api/follow/${userId}`, { method: on ? "DELETE" : "POST" });
      setOn(!on);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <button className={on ? "btn-outline" : "btn-primary"} onClick={click}>
      {on ? "Following" : "Follow"}
    </button>
  );
}
