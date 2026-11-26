"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, X } from "lucide-react";
import { api, setPP, toast } from "@/lib/client";
import { cn } from "@/lib/utils";
import { AGE_RANGES, DEADLINE_PRESETS, KID_AGES, TITLE_MAX } from "@/lib/constants";
import { pointsTier } from "@/server/services/priority";
import { Bar } from "@/components/ui/Bar";
import { OptionEditor, type OptionDraft } from "./OptionEditor";
import { cleanTarget, type BattleTarget } from "@/server/services/targeting";
import { useZipTargets } from "@/lib/use-zip";

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
  isAdmin = false,
}: {
  pp: number;
  tiers: { highAt: number; topAt: number };
  openLoops: number;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [a, setA] = useState<OptionDraft>({ label: "" });
  const [b, setB] = useState<OptionDraft>({ label: "" });
  const [review, setReview] = useState(false);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [context, setContext] = useState("");
  const [postAs, setPostAs] = useState("");
  const [target, setTarget] = useState<BattleTarget>({});
  const [targetOpen, setTargetOpen] = useState(false);
  const [zipText, setZipText] = useState("");
  const [deadline, setDeadline] = useState<number>(24);
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Draft autosave (PRD B-12). Photos are uploaded to Blob the moment they're picked, so the draft
  // keeps their URLs (not the files): leaving the page and coming back restores everything.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d) {
        // Old drafts stored just the option names as strings.
        setA(typeof d.a === "string" ? { label: d.a } : (d.a ?? { label: "" }));
        setB(typeof d.b === "string" ? { label: d.b } : (d.b ?? { label: "" }));
        setContext(d.context ?? "");
        if (d.titleEdited) {
          setTitle(d.title ?? "");
          setTitleEdited(true);
        }
        if (d.target) setTarget(d.target);
        if (d.zipText) setZipText(d.zipText);
        // Drafts saved before the 5-day max could hold 168 (7 days): fall back to the longest preset still offered.
        if (d.deadline) setDeadline(DEADLINE_PRESETS.some((p) => p.hours === d.deadline) ? d.deadline : DEADLINE_PRESETS[DEADLINE_PRESETS.length - 1].hours);
        if (d.visibility) setVisibility(d.visibility);
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ a, b, context, title, titleEdited, target, zipText, deadline, visibility }));
    } catch {}
  }, [loaded, a, b, context, title, titleEdited, target, zipText, deadline, visibility]);

  const zips = zipText
    .split(/[,\s]+/)
    .map((z) => z.trim())
    .filter(Boolean);
  const cleanedTarget = cleanTarget({ ...target, zips });
  const zipTargets = useZipTargets(zips);
  const targetCount = cleanedTarget ? Object.keys(cleanedTarget).filter((k) => k !== "kidAges").length : 0;

  const ready = a.label.trim().length > 0 && b.label.trim().length > 0;
  const suggestedTitle = `${a.label.trim()} or ${b.label.trim()}?`.slice(0, 100);
  const question = titleEdited ? title : suggestedTitle;
  const tier = pointsTier(pp, tiers.highAt, tiers.topAt);

  function openReview() {
    if (!ready) return;
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
          ...(isAdmin && postAs.trim() ? { postAs: postAs.trim() } : {}),
          tags: cleanedTarget ? { target: cleanedTarget } : {},
          visibility,
          deadlineHours: deadline,
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
        {/* Keyed on `loaded` so each editor re-derives its mode (photo / link / name) from the restored draft. */}
        <OptionEditor key={`a${loaded}`} side="A" value={a} onChange={setA} />
        <OptionEditor key={`b${loaded}`} side="B" value={b} onChange={setB} />
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">No photos where a child’s face is visible.</p>

      {/* The story sits right under the options (Alex, Nov 26): battles with no context ("Eric or Anne?") get skipped. */}
      <div className="mt-3 shrink-0">
        <label className="flex items-baseline justify-between text-[15px] text-ink" htmlFor="context">
          <span>
            The story <span className="text-xs text-zinc-500">· people pick better with it</span>
          </span>
          {context.length > 200 && <span className="text-xs text-zinc-500">{280 - context.length}</span>}
        </label>
        <textarea
          id="context"
          className="input mt-1.5 resize-none"
          rows={3}
          maxLength={280}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="What’s going on? Who it’s for, the budget, what you’re torn about…"
        />
      </div>

      <button className="btn-cta mt-3 w-full shrink-0 py-3" disabled={!ready} onClick={openReview}>
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
              {isAdmin && (
                <div className="rounded-lg bg-violet-soft p-3">
                  <label className="label !text-violet" htmlFor="post-as">
                    Post as (admin) — username
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">@</span>
                    <input
                      id="post-as"
                      className="input !bg-white"
                      placeholder="Leave empty to post as you"
                      maxLength={21}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      value={postAs}
                      onChange={(e) => setPostAs(e.target.value.replace(/^@/, "").toLowerCase())}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-600">The battle shows as posted by this user. A new profile is created if the username doesn’t exist.</p>
                </div>
              )}
              <div>
                <label className="label" htmlFor="title">
                  Question
                </label>
                <input
                  id="title"
                  className="input"
                  maxLength={TITLE_MAX}
                  value={question}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleEdited(true);
                  }}
                />
              </div>
              <div className="rounded-lg shadow-ring">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
                  aria-expanded={targetOpen}
                  aria-controls="target-panel"
                  onClick={() => setTargetOpen((o) => !o)}
                >
                  <span>
                    <span className="block text-[15px] text-ink">Target a specific group?</span>
                    <span className="block text-xs text-zinc-500">
                      {targetCount ? `${targetCount} filter${targetCount > 1 ? "s" : ""} · only matching people see it in Vote` : "Everyone can see it"}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-4 shrink-0 text-zinc-500 transition-transform", targetOpen && "rotate-180")} aria-hidden />
                </button>
                {targetOpen && (
                  <div id="target-panel" className="space-y-4 border-t border-ink/10 px-3.5 pb-3.5 pt-3">
                    <ChipGroup
                      label="Parents"
                      options={[
                        { id: "YES", label: "Parents" },
                        { id: "NO", label: "Not parents" },
                      ]}
                      value={target.parents ? [target.parents] : []}
                      onChange={(v) => {
                        const next = v.find((x) => x !== target.parents) as "YES" | "NO" | undefined;
                        setTarget((t) => ({ ...t, parents: next, kidAges: next === "YES" ? t.kidAges : undefined }));
                      }}
                    />
                    {target.parents === "YES" && (
                      <ChipGroup
                        label="With kids aged (optional)"
                        options={KID_AGES.map((k) => ({ id: k.id, label: k.label }))}
                        value={target.kidAges ?? []}
                        onChange={(v) => setTarget((t) => ({ ...t, kidAges: v }))}
                      />
                    )}
                    <ChipGroup
                      label="Age"
                      options={AGE_RANGES.map((r) => ({ id: r.id, label: r.label }))}
                      value={target.ageRanges ?? []}
                      onChange={(v) => setTarget((t) => ({ ...t, ageRanges: v }))}
                    />
                    <ChipGroup
                      label="Men or women"
                      options={[
                        { id: "FEMALE", label: "Women" },
                        { id: "MALE", label: "Men" },
                      ]}
                      value={target.sexes ?? []}
                      onChange={(v) => setTarget((t) => ({ ...t, sexes: v as BattleTarget["sexes"] }))}
                    />
                    <div>
                      <label className="label" htmlFor="target-zips">
                        ZIP codes
                      </label>
                      <input
                        id="target-zips"
                        className="input"
                        inputMode="text"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        placeholder="e.g. 10001, 11211"
                        maxLength={200}
                        value={zipText}
                        onChange={(e) => setZipText(e.target.value)}
                      />
                      {zipTargets.invalid.length > 0 ? (
                        <p className="mt-1.5 text-xs text-b">Not a real ZIP code or prefix: {zipTargets.invalid.join(", ")}</p>
                      ) : (
                        <p className="mt-1.5 text-xs text-zinc-500">Separate with commas. A shorter code like 941 matches every ZIP that starts with it.</p>
                      )}
                    </div>
                    {targetCount > 0 && (
                      <button
                        type="button"
                        className="text-[13px] text-zinc-600 underline"
                        onClick={() => {
                          setTarget({});
                          setZipText("");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
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

            </div>
            <div className="border-t border-ink/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button className="btn-cta w-full py-3" disabled={busy || zipTargets.checking || zipTargets.invalid.length > 0} onClick={publish}>
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
