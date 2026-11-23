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
  return null;
}
