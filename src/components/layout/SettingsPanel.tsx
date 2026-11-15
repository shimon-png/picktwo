"use client";
import { useState } from "react";
import { api, toast } from "@/lib/client";

type S = { notifyEmail: boolean; marketingEmail: boolean; dataConsent: boolean };

export function SettingsPanel({ initial }: { initial: S }) {
  const [s, setS] = useState(initial);
  async function toggle(k: keyof S) {
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
  const Row = ({ k, label, desc }: { k: keyof S; label: string; desc: string }) => (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-zinc-500">{desc}</span>
      </span>
      <input type="checkbox" role="switch" className="mt-1 size-5 accent-zinc-900" checked={s[k]} onChange={() => toggle(k)} />
    </label>
  );
  return (
    <>
      <section>
        <h2 className="text-lg font-bold">Notifications</h2>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <Row k="notifyEmail" label="Email reminders" desc="Voting closed and report-back reminders for your battles" />
          <Row k="marketingEmail" label="Product news" desc="Occasional updates about new features" />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-bold">Data & privacy</h2>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <Row k="dataConsent" label="Help improve recommendations" desc="Allow anonymised use of your battles, votes and outcomes. We never sell your identity." />
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
