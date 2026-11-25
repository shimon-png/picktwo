"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PREFILL_KEY } from "@/components/auth/OneTapSignup";

/**
 * Where Google sign-in returns from the one-tap sign-up card: saves what the card showed (username if edited, sex,
 * age, ZIP) on the new account, then a full page load of `next` so guest votes and answers move over.
 */
export default function SignupFinishPage() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next") ?? "/vote";
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/vote";
    let profile: Record<string, string> = {};
    try {
      profile = JSON.parse(localStorage.getItem(PREFILL_KEY) ?? "{}");
    } catch {}
    (async () => {
      try {
        const s = await api<{ complete: boolean }>("/api/me/quick-profile");
        if (!s.complete) await api("/api/me/quick-profile", { body: profile });
        try {
          localStorage.removeItem(PREFILL_KEY);
        } catch {}
        window.location.assign(safe);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);
  return (
    <div className="card mx-auto mt-10 max-w-sm p-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-red-600">{error}</p>
          <a href="/onboarding" className="btn-cta mt-3 inline-flex">
            Finish my profile
          </a>
        </>
      ) : (
        <p className="text-zinc-600">Saving your picks…</p>
      )}
    </div>
  );
}
