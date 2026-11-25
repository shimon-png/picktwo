"use client";
import { useState } from "react";
import { toast } from "@/lib/client";
import { logEvent } from "@/lib/events";

/** Share the 9:16 taste card: the phone's share sheet with the image where supported, else download it. */
export function ShareTaste({ className = "btn-cta w-full py-3" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const res = await fetch("/api/taste/card");
      if (!res.ok) throw new Error("Couldn't make your card. Try again.");
      const blob = await res.blob();
      const file = new File([blob], "my-crowdpick-taste.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      logEvent("taste_shared", { how: nav.canShare?.({ files: [file] }) ? "share_sheet" : "download" });
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: "My taste on crowdpick.ai. What's yours?", url: "https://crowdpick.ai" }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className={className} onClick={share} disabled={busy}>
      {busy ? "Making your card…" : "Share my profile"}
    </button>
  );
}
