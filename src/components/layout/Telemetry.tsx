"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logEvent } from "@/lib/events";

/**
 * Data brain: a `page_view` per route (the first event of a visit also logs `session_start` with ad tags,
 * referrer and landing page; see lib/events.ts). Renders nothing. See docs/brain/data-dictionary.md.
 */
export function Telemetry() {
  const path = usePathname();
  useEffect(() => {
    logEvent("page_view", { path });
  }, [path]);

  // `engaged`: the first tap/click or real scroll on this page view (Shimon, Nov 23: seeing isn't engaging;
  // bounce = never taps or scrolls). Taps on elements with data-track also log `home_click` with that target.
  useEffect(() => {
    let done = false;
    const engage = (how: "click" | "scroll") => {
      if (done) return;
      done = true;
      logEvent("engaged", { how, path });
    };
    const onScroll = () => {
      if (window.scrollY > 120) engage("scroll");
    };
    const onClick = (e: MouseEvent) => {
      engage("click");
      const el = (e.target as Element | null)?.closest?.("[data-track]");
      const target = el?.getAttribute("data-track");
      if (target) logEvent("home_click", { target, path });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
    };
  }, [path]);
  return null;
}
