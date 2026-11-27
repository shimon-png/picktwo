"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "@/lib/client";

export function ReportActions({ id }: { id: string }) {
  const router = useRouter();
  async function act(action: string) {
    try {
      await api(`/api/admin/reports/${id}`, { body: { action } });
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {[
        ["approve", "Approve (show)"],
        ["hide", "Keep hidden"],
        ["delete", "Delete"],
        ["ban", "Ban author"],
        ["dismiss", "Dismiss"],
      ].map(([a, label]) => (
        <button key={a} className={`chip !py-1 text-xs ${a === "ban" || a === "delete" ? "text-red-600" : ""}`} onClick={() => act(a)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function MessageActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(action: "handled" | "reopen") {
    setBusy(true);
    try {
      await api(`/api/admin/messages/${id}`, { body: { action } });
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return status === "NEW" ? (
    <button className="chip !py-1 text-xs" disabled={busy} onClick={() => act("handled")}>Mark handled</button>
  ) : (
    <button className="chip !py-1 text-xs" disabled={busy} onClick={() => act("reopen")}>Mark as new</button>
  );
}

export function ConfigEditor({ economy, features }: { economy: Record<string, number>; features: Record<string, unknown> }) {
  const [e, setE] = useState(economy);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/config", { body: { economy: e } });
      toast("Saved — takes effect within 30s", "ok");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">Priority Queue economy (PRD §5.3). Changes apply without a deploy.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(e).map(([k, v]) => (
          <label key={k} className="card flex items-center justify-between gap-2 p-2.5 text-sm">
            <span className="font-mono text-xs">{k}</span>
            <input type="number" step="any" className="input !w-24 !py-1 text-right" value={v} onChange={(ev) => setE({ ...e, [k]: Number(ev.target.value) })} />
          </label>
        ))}
      </div>
      <button className="btn-primary" disabled={busy} onClick={save}>Save economy</button>
      <pre className="card overflow-auto p-3 text-xs">{JSON.stringify(features, null, 2)}</pre>
    </div>
  );
}

export function RecomputeEngagement() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await api<{ returnsFilled: number; battlesScored: number }>("/api/admin/brain", { method: "POST" });
      toast(`Scored ${r.battlesScored} battles (${r.returnsFilled} returns found)`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className="chip !py-1 text-xs" onClick={run} disabled={busy}>
      {busy ? "Recomputing…" : "Recompute scores now"}
    </button>
  );
}

export function TagBattles({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await api<{ tagged: number; failed: number; remaining: number; enabled: boolean; error?: string | null }>("/api/admin/brain/tag", { method: "POST" });
      toast(r.enabled ? `Tagged ${r.tagged}${r.failed ? `, ${r.failed} failed${r.error ? ` (${r.error})` : ""}` : ""}. ${r.remaining} left.` : "Tagging is off: neither OPENAI_API_KEY nor ANTHROPIC_API_KEY is set in Vercel.", r.enabled ? "ok" : "error");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className="chip !py-1 text-xs" onClick={run} disabled={busy || remaining === 0}>
      {busy ? "Tagging…" : remaining ? `Tag next 25 of ${remaining} untagged` : "All battles tagged"}
    </button>
  );
}

export function LoadZipIncome({ rows }: { rows: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await api<{ loaded: number; year: number; error?: string }>("/api/admin/brain/zip-income", { method: "POST" });
      toast(r.error ? `Census: ${r.error}` : `Loaded ${r.loaded.toLocaleString()} ZIP areas (ACS ${r.year})`, r.error ? "error" : "ok");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className="chip !py-1 text-xs" onClick={run} disabled={busy}>
      {busy ? "Loading Census data…" : rows ? `Reload Census income (${rows.toLocaleString()} ZIPs)` : "Load Census income by ZIP"}
    </button>
  );
}
