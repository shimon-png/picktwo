"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { api, toast } from "@/lib/client";
import { CONTACT_TOPICS } from "@/lib/validators";

export function ContactForm({ initial }: { initial: { name: string; email: string; topic?: string } }) {
  const [f, setF] = useState({ name: initial.name, email: initial.email, topic: initial.topic ?? "question", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const started = useRef(Date.now());
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/contact", {
        body: { ...f, pageUrl: document.referrer || undefined, elapsedMs: Date.now() - started.current },
      });
      setSent(true);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="card space-y-3 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-green" aria-hidden />
        <h2 className="text-lg font-medium">Thanks, we got your message</h2>
        <p className="text-sm text-zinc-600">We read every message and will reply to {f.email} if a reply is needed.</p>
        <Link href="/vote" className="btn-primary mt-2 inline-flex">Back to voting</Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-name">Name <span className="text-zinc-400">(optional)</span></label>
          <input id="c-name" className="input" autoComplete="name" maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="c-email">Email <span className="text-b">*</span></label>
          <input id="c-email" type="email" className="input" autoComplete="email" maxLength={254} required value={f.email} onChange={(e) => set("email", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-topic">What’s it about?</label>
        <select id="c-topic" className="input" value={f.topic} onChange={(e) => set("topic", e.target.value)}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="c-message">Message <span className="text-b">*</span></label>
        <textarea
          id="c-message"
          className="input min-h-36 resize-y"
          required
          minLength={10}
          maxLength={4000}
          value={f.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="Tell us what’s going on. If it’s about a specific battle or user, include the link."
        />
        <div className="mt-1 text-right text-xs text-zinc-400">{f.message.length}/4000</div>
      </div>
      {/* Honeypot: hidden from people, tempting to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} />
      </div>
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
