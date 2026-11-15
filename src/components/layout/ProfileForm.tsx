"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, MessageCircle, ThumbsUp } from "lucide-react";
import { api, toast } from "@/lib/client";
import { INTERESTS, KID_AGES } from "@/lib/constants";
import { ChipGroup } from "@/components/compose/ComposeForm";

type Init = {
  name: string;
  handle: string;
  bio: string;
  kidAges: string[];
  country: string;
  region: string;
  interests: string[];
  dataConsent: boolean;
  isAdultConfirmed: boolean;
};

export function ProfileForm({ initial, mode, next = "/" }: { initial: Init; mode: "onboarding" | "settings"; next?: string }) {
  const [f, setF] = useState(initial);
  const [hasKids, setHasKids] = useState(initial.kidAges.length > 0);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "intro">("form");
  const router = useRouter();
  const set = <K extends keyof Init>(k: K, v: Init[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      await api("/api/me/profile", { body: { ...f, kidAges: hasKids ? f.kidAges : [], isAdultConfirmed: f.isAdultConfirmed || undefined } });
      if (mode === "onboarding") setStep("intro");
      else {
        toast("Saved", "ok");
        router.refresh();
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (step === "intro")
    return (
      <div className="space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 dark:from-amber-500/10 dark:to-orange-500/10">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="size-7 fill-pp text-pp" />
            <h2 className="font-display text-xl font-extrabold">How priority works</h2>
          </div>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">You start with 10 ⚡. Your ⚡ decides how fast your questions get answered.</p>
          <ol className="space-y-3 text-[15px]">
            <li className="flex gap-3">
              <MessageCircle className="mt-0.5 size-5 shrink-0 text-a" />
              <span>
                <b>Answer questions → earn priority.</b> +1 ⚡ per vote, +1 more when you add a reason.
              </span>
            </li>
            <li className="flex gap-3">
              <ThumbsUp className="mt-0.5 size-5 shrink-0 text-ok" />
              <span>
                <b>Close the loop → earn more.</b> Say which of your two options you picked and 👍/👎 how it went: +10 ⚡ (+5 if within 48h).
              </span>
            </li>
            <li className="flex gap-3">
              <Zap className="mt-0.5 size-5 shrink-0 text-pp" />
              <span>
                <b>Open loops slow you down.</b> Unreported past decisions push your new battles down the feed.
              </span>
            </li>
          </ol>
        </div>
        <button className="btn-primary w-full py-3" onClick={() => { router.push(next); router.refresh(); }}>
          Got it — let’s go
        </button>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Display name</label>
          <input id="name" className="input" maxLength={50} value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="handle">Username</label>
          <div className="flex items-center">
            <span className="mr-1 text-zinc-400">@</span>
            <input id="handle" className="input" maxLength={20} value={f.handle} onChange={(e) => set("handle", e.target.value.toLowerCase())} />
          </div>
        </div>
      </div>
      {mode === "settings" && (
        <div>
          <label className="label" htmlFor="bio">Bio</label>
          <input id="bio" className="input" maxLength={160} value={f.bio} onChange={(e) => set("bio", e.target.value)} />
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="label">Do you have kids?</legend>
        <div className="flex gap-2">
          <button type="button" className={`chip ${hasKids ? "chip-on" : ""}`} onClick={() => setHasKids(true)} aria-pressed={hasKids}>Yes</button>
          <button type="button" className={`chip ${!hasKids ? "chip-on" : ""}`} onClick={() => setHasKids(false)} aria-pressed={!hasKids}>No / prefer not to say</button>
        </div>
        {hasKids && (
          <>
            <ChipGroup label="Their age ranges (we never ask for names or birthdays)" options={KID_AGES.map((k) => ({ id: k.id, label: k.label }))} value={f.kidAges} onChange={(v) => set("kidAges", v)} />
          </>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="country">Country <span className="font-normal text-zinc-400">(optional)</span></label>
          <input id="country" className="input" maxLength={60} value={f.country} onChange={(e) => set("country", e.target.value)} placeholder="US" />
        </div>
        <div>
          <label className="label" htmlFor="region">City / state <span className="font-normal text-zinc-400">(optional)</span></label>
          <input id="region" className="input" maxLength={60} value={f.region} onChange={(e) => set("region", e.target.value)} />
        </div>
      </div>
      <ChipGroup label="Interests (optional)" options={INTERESTS.map((i) => ({ id: i, label: i }))} value={f.interests} onChange={(v) => set("interests", v)} />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-zinc-900" checked={f.dataConsent} onChange={(e) => set("dataConsent", e.target.checked)} />
        <span className="text-zinc-600 dark:text-zinc-400">
          Help improve PickTwo and AI recommendations by allowing anonymised use of my battles, votes and outcomes. We never sell your identity. You can change this anytime.
        </span>
      </label>
      {mode === "onboarding" && (
        <label className="flex items-start gap-3 text-sm font-medium">
          <input type="checkbox" className="mt-0.5 size-4 accent-zinc-900" checked={f.isAdultConfirmed} onChange={(e) => set("isAdultConfirmed", e.target.checked)} required />
          <span>I’m 18 or older and agree to the <a href="/legal/terms" className="underline" target="_blank">Terms</a> and <a href="/legal/guidelines" className="underline" target="_blank">Community guidelines</a>.</span>
        </label>
      )}
      <button className="btn-primary w-full py-3" disabled={busy || !f.name || f.handle.length < 3 || !f.isAdultConfirmed} onClick={save}>
        {busy ? "Saving…" : mode === "onboarding" ? "Continue" : "Save profile"}
      </button>
    </div>
  );
}
