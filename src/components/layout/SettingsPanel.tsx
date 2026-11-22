"use client";
import { useState } from "react";
import { api, toast } from "@/lib/client";

type DmPolicy = "EVERYONE" | "FOLLOWING" | "NOBODY";
type S = { notifyEmail: boolean; marketingEmail: boolean; dataConsent: boolean; showInVoteMatches: boolean; dmPolicy: DmPolicy };
type Toggle = "notifyEmail" | "marketingEmail" | "dataConsent" | "showInVoteMatches";

export function SettingsPanel({ initial }: { initial: S }) {
  const [s, setS] = useState(initial);
  async function setPolicy(dmPolicy: DmPolicy) {
    const prev = s;
    setS({ ...s, dmPolicy });
    try {
      await api("/api/me/profile", { body: { kind: "settings", dmPolicy } });
      toast("Saved", "ok");
    } catch (e) {
      setS(prev);
      toast((e as Error).message, "error");
    }
  }
  async function toggle(k: Toggle) {
    const next = { ...s, [k]: !s[k] };
    setS(next);
    try {
      await api("/api/me/profile", { body: { kind: "settings", [k]: next[k] } });
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
  return (
    <>
      <section>
        <h2 className="text-lg font-medium">Notifications</h2>
        <div className="divide-y divide-zinc-200">
          <Row k="notifyEmail" label="Email reminders" desc="Voting closed and report-back reminders for your battles" />
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
          <div className="py-3">
            <span className="block font-medium">Who can message me</span>
            <span className="block text-sm text-zinc-500">People you’ve already messaged can always reply. You can block anyone from a conversation.</span>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Who can message me">
              {(
                [
                  ["EVERYONE", "Everyone"],
                  ["FOLLOWING", "People I follow"],
                  ["NOBODY", "No one"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={s.dmPolicy === id}
                  className={s.dmPolicy === id ? "chip chip-on" : "chip"}
                  onClick={() => setPolicy(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
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
