"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUR_KEY } from "@/lib/tour";


type Step = { target?: string; title: string; body: string };

function steps(signedIn: boolean): Step[] {
  return [
    { title: "Welcome to crowdpick", body: "Real people stuck between two options. Here’s a 30-second tour. Tap anywhere to go to the next tip." },
    { target: "question", title: "The question", body: "Each card is someone’s real decision. Tap the question to see the full battle, reasons and comments." },
    { target: "option-a", title: "Throw to pick", body: "Grab the photo you like and throw it off the card to pick it. You’ll go straight to the next battle." },
    { target: "option-b", title: "Or tap", body: "Or just tap a photo to pick it and see how everyone else voted. You can change your mind until you hit Next." },
    { target: "skip", title: "Not sure? Skip", body: "Skip moves on to the next battle without voting." },
    signedIn
      ? { target: "account", title: "Your ⚡ priority", body: "Voting and adding reasons earns ⚡. More ⚡ means your own questions reach more voters, faster." }
      : { target: "account", title: "Sign in to earn ⚡", body: "Votes count without an account. Sign in to earn ⚡ and post your own questions." },
    { target: "status", title: "Where you stand", body: signedIn ? "This line shows how close you are to the next priority level." : "Your progress and tips show up here." },
    { target: "nav-vote", title: "Vote", body: "Your stack of battles to vote on. This is home." },
    { target: "nav-post", title: "Post", body: "Can’t decide? Add two options with photos or links and ask the crowd." },
    { target: "nav-you", title: "You", body: "Your ⚡, your battles, activity, settings, and the Tutorial button to replay this tour any time." },
    { title: "You’re all set", body: "Start swiping. Tap anywhere to finish." },
  ];
}

function findTarget(name?: string): HTMLElement | null {
  if (!name) return null;
  // Pick the first visible match (e.g. nav exists once, but be safe if a target renders twice).
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

const PAD = 6;

export function Tutorial({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vh, setVh] = useState(0);
  const all = useMemo(() => steps(signedIn), [signedIn]);

  // Start on first visit, or when asked to replay via ?tour=1.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const replay = params.get("tour") === "1";
    let seen = false;
    try {
      seen = !!localStorage.getItem(TOUR_KEY);
    } catch {}
    if (replay) router.replace(window.location.pathname, { scroll: false });
    if (!replay && seen) return;
    // Give the deck a moment to render its card.
    const t = setTimeout(() => {
      setI(0);
      setOpen(true);
    }, 350);
    return () => clearTimeout(t);
  }, [router]);

  // Skip steps whose element isn't on screen (e.g. empty deck).
  const visibleIndex = useCallback(
    (from: number) => {
      let k = from;
      while (k < all.length && all[k].target && !findTarget(all[k].target)) k++;
      return k;
    },
    [all],
  );

  const finish = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(TOUR_KEY, new Date().toISOString());
    } catch {}
  }, []);

  const go = useCallback(
    (from: number) => {
      const k = visibleIndex(from);
      if (k >= all.length) finish();
      else setI(k);
    },
    [all.length, finish, visibleIndex],
  );

  const step = all[i];

  // Measure the highlighted element and keep it in sync with scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      setVh(window.innerHeight);
      const el = findTarget(step?.target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const el = findTarget(step?.target);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 64 || r.bottom > window.innerHeight - 72) el.scrollIntoView({ block: "center" });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, i, step?.target]);

  // Keyboard: → / Enter / Space next, ← back, Esc closes.
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go(i + 1);
      } else if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, [open, i, go, finish]);

  if (!open || !step) return null;

  const hole = rect && step.target ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;
  // Put the tip below the highlight when it sits in the top half, above it otherwise.
  const below = hole ? hole.top + hole.height / 2 < vh / 2 : true;
  const tipStyle: React.CSSProperties = hole
    ? below
      ? { top: Math.min(hole.top + hole.height + 12, vh - 180) }
      : { bottom: Math.max(vh - hole.top + 12, 12) }
    : { top: "50%", transform: "translateY(-50%)" };
  const shown = all.filter((s) => !s.target || findTarget(s.target));
  const pos = shown.indexOf(step) + 1;

  return (
    <div
      className="fixed inset-0 z-[70] cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      onClick={() => go(i + 1)}
    >
      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[14px] ring-2 ring-white transition-all duration-300 ease-out"
          style={{ ...hole, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.62)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/60" />
      )}
      <div className="fixed inset-x-4 mx-auto max-w-sm transition-all duration-300 ease-out" style={tipStyle}>
        <div className="rounded-[14px] bg-white p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 id="tour-title" className="text-[17px] font-medium">
              {step.title}
            </h2>
            <button
              type="button"
              className="-mr-1 rounded-md p-1 text-zinc-400 hover:text-ink"
              aria-label="Close tutorial"
              onClick={(e) => {
                e.stopPropagation();
                finish();
              }}
            >
              <X className="size-4" />
            </button>
          </div>
          <p id="tour-body" className="text-sm text-zinc-600">
            {step.body}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1" aria-label={`Step ${pos} of ${shown.length}`}>
              {shown.map((s, k) => (
                <span key={k} className={cn("block h-1.5 rounded-full transition-all", k + 1 === pos ? "w-4 bg-accent" : "w-1.5 bg-ink/15")} />
              ))}
            </div>
            <span className="text-[13px] text-accent">{pos === shown.length ? "Tap to finish" : "Tap to continue"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
