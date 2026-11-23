"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  SIGNUP_CONVERSION_COOKIE,
  X_PIXEL_ID,
  X_SIGNUP_EVENT_ID,
} from "@/lib/marketing";

/**
 * Fires the sign-up conversion after in-app navigations (the inline pixel script only runs on full page loads).
 * Only acts once X's base code has defined `twq`; whichever of the two runs first clears the cookie, so it fires once.
 */
export function SignupConversion() {
  const path = usePathname();
  useEffect(() => {
    try {
      const twq = (window as unknown as { twq?: (...a: unknown[]) => void })
        .twq;
      if (!X_PIXEL_ID || !twq) return;
      const m = document.cookie.match(
        new RegExp(`(?:^|; )${SIGNUP_CONVERSION_COOKIE}=([^;]*)`),
      );
      if (!m) return;
      document.cookie = `${SIGNUP_CONVERSION_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
      twq("event", X_SIGNUP_EVENT_ID, {
        conversion_id: decodeURIComponent(m[1]),
      });
    } catch {}
  }, [path]);
  return null;
}
