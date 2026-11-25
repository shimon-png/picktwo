"use client";
import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { logEvent } from "@/lib/events";
import { platformFrom, shouldSuggestInstall, type InstallPlatform } from "@/lib/install";

const VISITS = "cp:visits";
const DISMISSED = "cp:install-dismissed";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: BIP | null = null;
if (typeof window !== "undefined")
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIP;
  });

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

export function isStandalone() {
  return typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
}

/**
 * "Add crowdpick to your home screen" (PRD phase 4): a one-line card on phones after a couple of visits. Android uses
 * the browser's own install prompt; iPhone gets the two steps (Share → Add to Home Screen). "Not now" snoozes 14 days.
 * `force` shows it right away (e.g. when push needs it on iPhone).
 */
export function InstallPrompt({ place, force = false, reason }: { place: string; force?: boolean; reason?: string }) {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [show, setShow] = useState(false);
  const [steps, setSteps] = useState(false);
  useEffect(() => {
    const p = platformFrom(navigator.userAgent);
    setPlatform(p);
    const visits = Number(read(VISITS) ?? 0) + (sessionStorage.getItem(VISITS) ? 0 : 1);
    try {
      if (!sessionStorage.getItem(VISITS)) {
        sessionStorage.setItem(VISITS, "1");
        write(VISITS, String(visits));
      }
    } catch {}
    const ok = force
      ? !isStandalone() && p !== "desktop"
      : shouldSuggestInstall({ platform: p, standalone: isStandalone(), visits, dismissedAt: Number(read(DISMISSED)) || null, now: Date.now(), canPrompt: !!deferred });
    setShow(ok);
    if (ok) logEvent("install_prompt_shown", { place, platform: p });
  }, [place, force]);
  if (!show || !platform) return null;
  const add = async () => {
    logEvent("install_prompt_tap", { place, platform });
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === "accepted") setShow(false);
    } else setSteps(true);
  };
  return (
    <div className="card relative space-y-2 px-4 py-3" data-testid="install-prompt">
      <button
        type="button"
        aria-label="Not now"
        className="absolute right-2 top-2 p-1 text-ink/40"
        onClick={() => {
          write(DISMISSED, String(Date.now()));
          setShow(false);
        }}
      >
        <X className="size-4" />
      </button>
      <p className="pr-6 text-[14px] font-medium text-ink">{reason ?? "Add crowdpick to your home screen"}</p>
      <p className="text-[13px] text-ink/65">Opens like an app, full screen, and can tell you when your results are in.</p>
      {steps || (platform === "ios" && !deferred) ? (
        <ol className="space-y-1 text-[13px] text-ink/80">
          <li className="flex items-center gap-1.5">
            1. Tap <Share className="size-4" aria-label="Share" /> at the bottom of Safari
          </li>
          <li className="flex items-center gap-1.5">
            2. Choose <SquarePlus className="size-4" aria-hidden /> <b>Add to Home Screen</b>
          </li>
        </ol>
      ) : (
        <button type="button" className="btn-primary !py-1.5 text-[14px]" onClick={add}>
          Add to home screen
        </button>
      )}
    </div>
  );
}
