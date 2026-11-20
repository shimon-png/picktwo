"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { api, setPP, toast } from "@/lib/client";
import { cn } from "@/lib/utils";
import { CATEGORIES, DEADLINE_PRESETS, KID_AGES, guessCategory } from "@/lib/constants";
import { pointsTier } from "@/server/services/priority";
import { Bar } from "@/components/ui/Bar";
import { OptionEditor, type OptionDraft } from "./OptionEditor";

type Visibility = "PUBLIC" | "LINK_ONLY" | "FRIENDS";
const DRAFT_KEY = "pt:draft";

const AUDIENCE: { id: Visibility; label: string; desc: string }[] = [
  { id: "PUBLIC", label: "Everyone", desc: "Shared by link and shown to relevant voters." },
  { id: "LINK_ONLY", label: "Link only", desc: "Only people you send the link to." },
  { id: "FRIENDS", label: "Friends", desc: "Mutual follows, signed in." },
];

export function ComposeForm({
  pp,
  tiers,
  openLoops,
  accountConsent,
}: {
  pp: number;
  tiers: { highAt: number; topAt: number };
  openLoops: number;
  accountConsent: boolean;
}) {
  const router = useRouter();
  const [a, setA] = useState<OptionDraft>({ label: "" });
  const [b, setB] = useState<OptionDraft>({ label: "" });
  const [review, setReview] = useState(false);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [context, setContext] = useState("");
  const [categoryId, setCategoryId] = useState<string>("gifts");
  const [categoryPicked, setCategoryPicked] = useState(false);
  const [kidAge, setKidAge] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<number>(24);
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [dataConsent, setDataConsent] = useState(true);
  const [busy, setBusy] = useState(false);

  // Draft autosave (PRD B-12) — text fields only (images can be large)
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d) {
        setA((x) => ({ ...x, label: d.a ?? "" }));
        setB((x) => ({ ...x, label: d.b ?? "" }));
        setContext(d.context ?? "");
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ context, a: a.label, b: b.label }));
    } catch {}
  }, [context, a.label, b.label]);

  const ready = a.label.trim().length > 0 && b.label.trim().length > 0;
  const suggestedTitle = `${a.label.trim()} or ${b.label.trim()}?`.slice(0, 100);
  const question = titleEdited ? title : suggestedTitle;
  const tier = pointsTier(pp, tiers.highAt, tiers.topAt);

  function openReview() {
    if (!ready) return;
    if (!categoryPicked) setCategoryId(guessCategory(`${a.label} ${b.label} ${a.urlTitle ?? ""} ${b.urlTitle ?? ""}`));
    setReview(true);
  }

  async function publish() {
    if (question.trim().length < 3) return toast("Add a question (3+ characters)", "error");
    setBusy(true);
    try {
      const r = await api<{ slug: string; bonus: number }>("/api/battles", {
        body: {
          title: question.trim(),
          context: context.trim(),
          categoryId,
          tags: kidAge.length ? { kidAge } : {},
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
        toast(`+${r.bonus} for your first battle`, "pp");
        const me = await api<{ ppBalance: number }>("/api/me/priority").catch(() => null);
        setPP(me?.ppBalance);
      }
      router.push(`/b/${r.slug}/published`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <div className="-mx-4 -mt-2 flex h-dvh flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:h-[calc(100dvh-1rem)]">
      <div className="flex h-12 shrink-0 items-center">
        <Link href="/vote" className="-ml-2 rounded-lg p-2 text-ink hover:bg-surface" aria-label="Close">
          <X className="size-5" />
        </Link>
      </div>
      <h1 className="display text-[26px] leading-tight">What are you deciding between?</h1>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <OptionEditor side="A" value={a} onChange={setA} />
        <OptionEditor side="B" value={b} onChange={setB} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">No photos where a child’s face is visible.</p>

      <button className="btn-primary mt-3 w-full shrink-0 py-3" disabled={!ready} onClick={openReview}>
        Continue <ArrowRight className="size-4" aria-hidden />
      </button>

      {review && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <button className="absolute inset-0 bg-ink/35" aria-label="Back to options" onClick={() => setReview(false)} />
          <div className="animate-sheet relative flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-[20px] bg-white shadow-lift">
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-zinc-300" aria-hidden />
            <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
              <h2 id="review-title" className="text-lg">
                Review &amp; publish
              </h2>
              <span className="text-xs text-zinc-500">All optional</span>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
              <div>
                <label className="label" htmlFor="title">
                  Question
                </label>
                <input
                  id="title"
                  className="input"
                  maxLength={100}
                  value={question}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleEdited(true);
                  }}
                />
              </div>
              <div>
                <label className="label" htmlFor="context">
                  Context — helps people give better advice
                </label>
                <textarea
                  id="context"
                  className="input"
                  rows={2}
                  maxLength={280}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Gift for my 6-year-old, loves art, ~$50"
                />
              </div>

              <ChipGroup
                label={
                  <>
                    Category{!categoryPicked && <span className="text-accent"> · we guessed</span>}
                  </>
                }
                options={CATEGORIES.map((c) => ({ id: c.id, label: c.name }))}
                value={[categoryId]}
                onChange={(v) => {
                  setCategoryId(v[0] ?? "other");
                  setCategoryPicked(true);
                }}
                single
              />
              <ChipGroup
                label={<>Kid’s age · matches you with parents of same-age kids</>}
                options={KID_AGES.map((k) => ({ id: k.id, label: k.label }))}
                value={kidAge}
                onChange={setKidAge}
              />
              <ChipGroup
                label="Voting closes in"
                options={DEADLINE_PRESETS.map((d) => ({ id: String(d.hours), label: d.label }))}
                value={[String(deadline)]}
                onChange={(v) => setDeadline(Number(v[0] ?? 24))}
                single
              />

              <fieldset>
                <legend className="label">Who can vote</legend>
                <div className="grid grid-cols-3 gap-2">
                  {AUDIENCE.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={visibility === o.id}
                      onClick={() => setVisibility(o.id)}
                      className={cn("rounded-lg py-2 text-sm shadow-ring", visibility === o.id ? "bg-accent-900 text-accent ring-1 ring-accent" : "bg-white text-ink")}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-zinc-500">{AUDIENCE.find((o) => o.id === visibility)!.desc}</p>
              </fieldset>

              <div className="flex items-center gap-3 rounded-lg bg-accent-900 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-accent-200">
                    {openLoops > 0 ? `${tier.tier} priority · ${openLoops} open loop${openLoops > 1 ? "s" : ""} lowers your reach` : `${tier.tier} priority`}
                  </div>
                  <Bar value={tier.progress} className="mt-1.5" />
                </div>
                {tier.next && (
                  <Link href="/vote" className="btn-ghost shrink-0 !px-2 !py-1 text-[13px]">
                    Boost first
                  </Link>
                )}
              </div>

              <label className="flex items-start gap-2.5 text-[13px] text-zinc-600">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-accent"
                  checked={dataConsent && accountConsent}
                  disabled={!accountConsent}
                  onChange={(e) => setDataConsent(e.target.checked)}
                />
                <span>
                  Let crowdpick use this battle, anonymised, to improve recommendations.
                  {!accountConsent && (
                    <span className="block text-xs text-zinc-400">
                      Turn on data sharing in{" "}
                      <Link href="/settings" className="underline">
                        Settings
                      </Link>{" "}
                      to enable this.
                    </span>
                  )}
                </span>
              </label>
            </div>
            <div className="border-t border-ink/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button className="btn-primary w-full py-3" disabled={busy} onClick={publish}>
                {busy ? "Publishing…" : "Publish & share"}
              </button>
            </div>
          </div>
        </div>
      )}
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
}: {
  label: React.ReactNode;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.id);
          return (
            <button
              type="button"
              key={o.id}
              aria-pressed={on}
              className={cn("chip", on && "chip-on")}
              onClick={() => {
                if (single) onChange([o.id]);
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
