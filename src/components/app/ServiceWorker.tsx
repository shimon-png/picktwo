"use client";
import { useEffect } from "react";
import { logEvent } from "@/lib/events";

/** Registers /sw.js (web push) and logs a home-screen install. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onInstalled = () => logEvent("app_installed", {});
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);
  return null;
}
