"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, toast } from "@/lib/client";

type EmailPrefs = Partial<Record<"voted" | "weekly" | "tips" | "messages", boolean>>;
type S = { notifyEmail: boolean; marketingEmail: boolean; dataConsent: boolean; showInVoteMatches: boolean; chatEnabled: boolean };
type Toggle = keyof S;
const EMAIL_GROUPS = [
  ["voted", "Battles I voted on", "How they turned out, “you called it”, when your reason helped"],
  ["weekly", "Weekly roundup", "A few battles picked for you and how your past picks turned out"],
  ["tips", "Tips & reminders", "Getting started, reaching a new priority tier, points about to fade"],
  ["messages", "Message requests", "When someone who follows you wants to send you a message"],
] as const;

export function SettingsPanel({
  initial,
  emailPrefs: emailPrefsInitial = {},
  focusChat = false,
  returnTo = null,
}: {
  initial: S;
  emailPrefs?: EmailPrefs;
  focusChat?: boolean;
  returnTo?: string | null;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [ep, setEp] = useState<EmailPrefs>(emailPrefsInitial);
  async function setGroup(group: keyof EmailPrefs, on: boolean) {
    const prev = ep;
    setEp({ ...ep, [group]: on });
    try {
      await api("/api/me/profile", { body: { kind: "email", group, on } });
      toast("Saved", "ok");
    } catch (e) {
      setEp(prev);
      toast((e as Error).message, "error");
    }
  }
  async function toggle(k: Toggle) {
    const next = { ...s, [k]: !s[k] };
    setS(next);
    try {
      await api("/api/me/profile", { body: { kind: "settings", [k]: next[k] } });
      // Turned messages on from a DM flow: go straight back to it.
      if (k === "chatEnabled" && next.chatEnabled && returnTo) {
        toast("Messages turned on", "ok");
        router.push(returnTo);
        router.refresh();
        return;
      }
      toast("Saved", "ok");
    } catch (e) {
      setS(s);
      toast((e as Error).message, "error");
    }
  }
  async function del() {
    if (!window.confirm("Delete your account? Your profile and battles will be removed. Your votes stay as anonymous counts. This can't be undone.")) return;
    try {
      await api("/api/me", { method: "DELETE" });
      window.location.href = "/";
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  const Row = ({ k, label, desc }: { k: Toggle; label: string; desc: string }) => (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-zinc-500">{desc}</span>
      </span>
      <input type="checkbox" role="switch" className="mt-1 size-5 accent-zinc-900" checked={s[k]} onChange={() => toggle(k)} />
    </label>
  );
  const messages = (
    <section id="messages" className={focusChat ? "scroll-mt-20 rounded-[16px] p-4 ring-2 ring-accent" : "scroll-mt-20"}>
      <h2 className="text-lg font-medium">{focusChat && !s.chatEnabled ? "Turn on messages to continue" : "Messages"}</h2>
      <div className="divide-y divide-zinc-200">
        <Row
          k="chatEnabled"
          label="Direct messages"
          desc="Off by default. When on, you can send a DM to people you follow, and accept message requests from people who follow you, one at a time. Nobody can message you without your OK."
        />
      </div>
      {focusChat && s.chatEnabled && returnTo && (
        <Link href={returnTo} className="btn-primary mt-2">
          Continue
        </Link>
      )}
    </section>
  );
  return (
    <>
      {messages}
      <section id="email" className="scroll-mt-20">
        <h2 className="text-lg font-medium">Email</h2>
        <p className="text-sm text-zinc-500">Sign-in codes always send. Everything else is up to you, and we never send more than one of the extras a day.</p>
        <div className="divide-y divide-zinc-200">
          <Row k="notifyEmail" label="My battles" desc="Your battle is live, vote milestones, results, close-the-loop reminders" />
          {EMAIL_GROUPS.map(([g, label, desc]) => (
            <label key={g} className="flex items-start justify-between gap-4 py-3">
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-zinc-500">{desc}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={label}
                className="mt-1 size-5 accent-zinc-900"
                checked={ep[g] !== false}
                onChange={(e) => setGroup(g, e.target.checked)}
              />
            </label>
          ))}
          <Row k="marketingEmail" label="Product news" desc="Occasional updates about new features" />
        </div>
      </section>
      <section id="privacy" className="scroll-mt-20">
        <h2 className="text-lg font-medium">Data & privacy</h2>
        <div className="divide-y divide-zinc-200">
          <Row
            k="showInVoteMatches"
            label="Show me in “Voted like you”"
            desc="People who picked the same side on a battle can see you voted like them, and you appear in their taste twins. Turning this off also hides those lists from you."
          />
          <Row k="dataConsent" label="Help improve recommendations" desc="Let crowdpick use your battles, votes and outcomes, anonymised, to improve recommendations. Applies to all your battles. We never sell your identity." />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/me/export" className="btn-outline">
            Download my data
          </a>
          <button className="btn-ghost text-red-600" onClick={del}>
            Delete account
          </button>
        </div>
      </section>
    </>
  );
}
