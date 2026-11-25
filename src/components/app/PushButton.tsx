"use client";
import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { api, toast } from "@/lib/client";
import { platformFrom } from "@/lib/install";
import { InstallPrompt, isStandalone } from "./InstallPrompt";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/**
 * "Notify me when the results are in" (web push). Hidden when push isn't set up or the browser can't do it. On an
 * iPhone outside the home-screen app, push isn't available, so it shows the install steps instead.
 */
export function PushButton({ label = "Notify me when the results are in" }: { label?: string }) {
  const [state, setState] = useState<"hidden" | "ios-install" | "ready" | "on">("hidden");
  useEffect(() => {
    if (!KEY) return;
    const ios = platformFrom(navigator.userAgent) === "ios";
    if (ios && !isStandalone()) return setState("ios-install");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setState(s && Notification.permission === "granted" ? "on" : Notification.permission === "denied" ? "hidden" : "ready"))
      .catch(() => {});
  }, []);
  if (state === "hidden") return null;
  if (state === "ios-install") return <InstallPrompt place="push" force reason="Get a notification when the results are in" />;
  if (state === "on")
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-ink/60">
        <Check className="size-4 text-green" /> You’ll get a notification when the results are in.
      </p>
    );
  return (
    <button
      type="button"
      className="btn-outline inline-flex items-center gap-2 !py-1.5 text-[14px]"
      onClick={async () => {
        try {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return setState("hidden");
          const reg = await navigator.serviceWorker.ready;
          const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
          await api("/api/push", { body: sub.toJSON() });
          setState("on");
        } catch (e) {
          toast((e as Error).message || "Couldn't turn on notifications", "error");
        }
      }}
    >
      <BellRing className="size-4" /> {label}
    </button>
  );
}
