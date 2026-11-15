"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Globe, Lock, Users, Zap } from "lucide-react";
import { api, setPP, toast } from "@/lib/client";
import { cn } from "@/lib/utils";
import { BUDGETS, CATEGORIES, DEADLINE_PRESETS, KID_AGES, OCCASIONS, RECIPIENTS } from "@/lib/constants";
import { OptionEditor, type OptionDraft } from "./OptionEditor";

type Tier = { tier: "High" | "Normal" | "Low"; reason: string };
const DRAFT_KEY = "pt:draft";

export function ComposeForm({ tier, dataConsentDefault, accountConsent }: { tier: Tier; dataConsentDefault: boolean; accountConsent: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [a, setA] = useState<OptionDraft>({ label: "" });
  const [b, setB] = useState<OptionDraft>({ label: "" });
  const [title, setTitle] = useState("Which one?");
  const [context, setContext] = useState("");
  const [categoryId, setCategoryId] = useState<string>("gifts");
  const [kidAge, setKidAge] = useState<string[]>([]);
  const [recipient, setRecipient] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [occasion, setOccasion] = useState<string>("");
  const [deadline, setDeadline] = useState<number>(24);
  const [visibility, setVisibility] = useState<"PUBLIC" | "LINK_ONLY" | "FRIENDS">("PUBLIC");
  const [dataConsent, setDataConsent] = useState(dataConsentDefault);
  const [busy, setBusy] = useState(false);

  // Draft autosave (PRD B-12) — text fields only (images can be large)
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d) {
        setTitle(d.title ?? "Which one?");
        setContext(d.context ?? "");
        setCategoryId(d.categoryId ?? "gifts");
        setA((x) => ({ ...x, label: d.a ?? "" }));
        setB((x) => ({ ...x, label: d.b ?? "" }));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, context, categoryId, a: a.label, b: b.label }));
    } catch {}
  }, [title, context, categoryId, a.label, b.label]);

  const step1Ok = a.label.trim().length > 0 && b.label.trim().length > 0;
  const step2Ok = title.trim().length >= 3;

  async function publish() {
    setBusy(true);
    try {
      const r = await api<{ slug: string; bonus: number }>("/api/battles", {
        body: {
          title: title.trim(),
          context: context.trim(),
          categoryId,
          tags: {
            ...(kidAge.length ? { kidAge } : {}),
            ...(recipient ? { recipient } : {}),
            ...(budget ? { budget } : {}),
            ...(occasion ? { occasion } : {}),
          },
          visibility,
          deadlineHours: deadline,
          dataConsent: dataConsent && accountConsent,
          options: [clean(a), clean(b)],
        },
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      if (r.bonus) {
        toast(`+${r.bonus} ⚡ for your first battle!`, "pp");
        const me = await api<{ ppBalance: number }>("/api/me/priority").catch(() => null);
        setPP(me?.ppBalance);
      }
      router.push(`/b/${r.slug}?new=1`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">New battle</h1>
        <span className="text-sm font-medium text-zinc-500">Step {step} of 3</span>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((s) => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-zinc-900 dark:bg-white" : "bg-zinc-200 dark:bg-zinc-800")} />
        ))}
      </div>

      {step === 1 && (
        <section className="space-y-4">
          <p className="text-[15px] text-zinc-600 dark:text-zinc-400">Add your two options — a photo, a link, or just a name.</p>
          <div className="flex gap-3">
            <OptionEditor side="A" value={a} onChange={setA} />
            <OptionEditor side="B" value={b} onChange={setB} />
          </div>
          <p className="text-xs text-zinc-400">Please don’t post photos where a child’s face is visible.</p>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <div>
            <label className="label" htmlFor="title">Your question</label>
            <input id="title" className="input font-semibold" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="context">
              Context <span className="font-normal text-zinc-400">— helps people give better advice</span>
            </label>
            <textarea
              id="context"
              className="input"
              rows={3}
              maxLength={280}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Gift for my 6-year-old daughter, loves art, budget ~$50"
            />
            <div className="mt-1 text-right text-xs text-zinc-400">{context.length}/280</div>
          </div>
          <ChipGroup label="Category" options={CATEGORIES.map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))} value={[categoryId]} onChange={(v) => setCategoryId(v[0] ?? "other")} single />
          <ChipGroup label="Kid’s age (optional)" options={KID_AGES.map((k) => ({ id: k.id, label: k.label }))} value={kidAge} onChange={setKidAge} />
          <ChipGroup label="For whom? (optional)" options={RECIPIENTS.map((r) => ({ id: r, label: r }))} value={recipient ? [recipient] : []} onChange={(v) => setRecipient(v[0] ?? "")} single allowNone />
          <ChipGroup label="Budget (optional)" options={BUDGETS.map((r) => ({ id: r, label: r }))} value={budget ? [budget] : []} onChange={(v) => setBudget(v[0] ?? "")} single allowNone />
          <ChipGroup label="Occasion (optional)" options={OCCASIONS.map((r) => ({ id: r, label: r }))} value={occasion ? [occasion] : []} onChange={(v) => setOccasion(v[0] ?? "")} single allowNone />
          <ChipGroup
            label="Voting closes in"
            options={DEADLINE_PRESETS.map((d) => ({ id: String(d.hours), label: d.label }))}
            value={[String(deadline)]}
            onChange={(v) => setDeadline(Number(v[0] ?? 24))}
            single
          />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5">
          <div className="space-y-2">
            <span className="label">Who can vote?</span>
            {(
              [
                ["PUBLIC", Globe, "Friends + community", "Shared by link and shown to relevant voters"],
                ["LINK_ONLY", Lock, "Link only", "Only people you send the link to"],
                ["FRIENDS", Users, "Friends only", "Mutual follows, signed in"],
              ] as const
            ).map(([id, Icon, label, desc]) => (
              <button
                key={id}
                onClick={() => setVisibility(id)}
                aria-pressed={visibility === id}
                className={cn("card flex w-full items-center gap-3 p-3 text-left", visibility === id && "border-zinc-900 ring-2 ring-zinc-900/10 dark:border-white")}
              >
                <Icon className="size-5 shrink-0 text-zinc-500" />
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-zinc-500">{desc}</span>
                </span>
              </button>
            ))}
          </div>

          {visibility === "PUBLIC" && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-2xl p-4",
                tier.tier === "Low" ? "bg-b-soft text-red-900 dark:bg-b/15 dark:text-red-200" : "bg-pp-soft text-amber-900 dark:bg-amber-500/10 dark:text-amber-200",
              )}
            >
              <Zap className="mt-0.5 size-5 shrink-0 fill-pp text-pp" />
              <div className="text-sm">
                <div className="font-bold">Community priority: {tier.tier}</div>
                <div>{tier.reason}</div>
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-zinc-900"
              checked={dataConsent && accountConsent}
              disabled={!accountConsent}
              onChange={(e) => setDataConsent(e.target.checked)}
            />
            <span className="text-zinc-600 dark:text-zinc-400">
              Allow this battle to be used, anonymised, to improve PickTwo’s recommendations.
              {!accountConsent && <span className="block text-xs text-zinc-400">Turn on data sharing in Settings to enable this.</span>}
            </span>
          </label>
        </section>
      )}

      <div className="flex gap-2 pt-2">
        {step > 1 && (
          <button className="btn-outline" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="size-4" /> Back
          </button>
        )}
        {step < 3 ? (
          <button className="btn-primary flex-1 py-3" disabled={step === 1 ? !step1Ok : !step2Ok} onClick={() => setStep(step + 1)}>
            Next <ArrowRight className="size-4" />
          </button>
        ) : (
          <button className="btn flex-1 bg-gradient-to-r from-a to-b py-3 text-base text-white" disabled={busy} onClick={publish}>
            {busy ? "Publishing…" : "Publish & share"}
          </button>
        )}
      </div>
    </div>
  );
}

function clean(o: OptionDraft) {
  return {
    label: o.label.trim(),
    imageUrl: o.imageUrl || undefined,
    url: o.url || undefined,
    urlTitle: o.urlTitle || undefined,
    urlImage: o.urlImage || undefined,
    priceCents: o.priceCents ?? undefined,
    currency: o.currency ?? undefined,
  };
}

export function ChipGroup({
  label,
  options,
  value,
  onChange,
  single,
  allowNone,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
  allowNone?: boolean;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.id);
          return (
            <button
              type="button"
              key={o.id}
              aria-pressed={on}
              className={cn("chip", on && "chip-on")}
              onClick={() => {
                if (single) onChange(on && allowNone ? [] : [o.id]);
                else onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id]);
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
