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
      {["hide", "delete", "ban", "restore", "dismiss"].map((a) => (
        <button key={a} className={`chip !py-1 text-xs ${a === "ban" || a === "delete" ? "text-red-600" : ""}`} onClick={() => act(a)}>
          {a}
        </button>
      ))}
    </div>
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

export function AdminSeed() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function run() {
    setBusy(true);
    try {
      const r = await api<{ demo: unknown }>("/api/admin/seed", { method: "POST" });
      toast(`Seed: ${JSON.stringify(r.demo)}`, "ok");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-semibold">Demo content</h2>
      <p className="text-sm text-zinc-500">Adds ~18 sample gift/name/purchase battles (some with outcomes) so the feed isn’t empty at launch. Safe to run once.</p>
      <button className="btn-outline" disabled={busy} onClick={run}>Seed demo battles</button>
    </section>
  );
}
