/* eslint-disable @next/next/no-img-element */
"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type OptionData = {
  id: string;
  side: "A" | "B";
  label: string;
  description?: string | null;
  imageUrl: string | null;
  url: string | null;
  urlImage: string | null;
  priceCents: number | null;
  currency: string | null;
};

/**
 * The visual face of an option tile: photo / link preview if present, otherwise a text card
 * (`TextFace`: the option's words in a fun font on a plain colour, one for A and one for B).
 * Percent overlays after a vote.
 */
export function OptionFace({
  side,
  label,
  description,
  image,
  percent,
  ring,
  hot,
  className,
  big,
  compact,
  children,
}: {
  side: "A" | "B";
  label: string;
  description?: string | null;
  image?: string | null;
  percent?: number | null;
  ring?: boolean;
  hot?: boolean;
  className?: string;
  big?: boolean;
  /** Squeezed narrow by the drag-to-grow deck: keep the photo and %, hide the text. */
  compact?: boolean;
  /** Extra content under the name (e.g. result bars on the picked photo). */
  children?: React.ReactNode;
}) {
  const isA = side === "A";
  if (!image)
    return (
      <TextFace
        {...{
          side,
          label,
          description,
          percent,
          ring,
          hot,
          className,
          big,
          compact,
        }}
      >
        {children}
      </TextFace>
    );
  return (
    <span
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-[14px] text-left transition",
        isA
          ? "bg-gradient-to-b from-a-soft to-white"
          : "bg-gradient-to-b from-b-soft to-white",
        className,
      )}
    >
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 size-full object-cover"
          draggable={false}
          loading="lazy"
        />
      )}
      <span
        className={cn(
          "relative z-10 m-2.5 flex size-5 items-center justify-center rounded-full border text-[11px]",
          image ? "border-white bg-white/90" : "bg-white/60",
          isA ? "border-a text-a" : "border-b text-b",
        )}
        aria-hidden
      >
        {side}
      </span>
      <span className="flex-1" />
      <span
        className={cn(
          "relative z-10 px-2.5 pb-2.5",
          image &&
            "bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-10",
        )}
      >
        {typeof percent === "number" && (
          <span
            className={cn(
              "block font-display leading-none tabular-nums",
              big ? "text-[34px]" : "text-[30px]",
              image ? "text-white" : isA ? "text-ink" : "text-b",
            )}
          >
            {percent}%
          </span>
        )}
        {!compact && (
          <span
            className={cn(
              "mt-1 line-clamp-3 block text-[13px] leading-snug",
              image ? "text-white" : "text-ink",
            )}
          >
            {label}
          </span>
        )}
        {description && !compact && (
          <span
            className={cn(
              "mt-0.5 line-clamp-4 block text-[11px] leading-snug",
              image ? "text-white/80" : "text-zinc-500",
            )}
          >
            {description}
          </span>
        )}
        {children}
      </span>
      {(ring || hot) && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-20 rounded-[14px] ring-inset",
            ring
              ? isA
                ? "ring-[2.5px] ring-a"
                : "ring-[2.5px] ring-b"
              : isA
                ? "ring-2 ring-a/60"
                : "ring-2 ring-b/60",
          )}
        />
      )}
    </span>
  );
}

/** Starting font size (px) for a text-only option: shorter text gets bigger. `useFitText` shrinks it to fit. */
function textPx(len: number, big?: boolean) {
  if (len <= 18) return big ? 30 : 22;
  if (len <= 40) return big ? 24 : 18;
  if (len <= 80) return big ? 19 : 15;
  return big ? 16 : 13;
}

/** Smallest scale `useFitText` will go to before it falls back to the "More" sheet. */
const MIN_FIT = 0.5;

/**
 * Shrinks the text inside `box` (via the `--fit` CSS variable, 1 → MIN_FIT) until `inner` fits, so the
 * whole label and description are always readable, nothing is cut off with "…". Re-fits when the box
 * changes size (the deck's winner grows to fill the card) and once web fonts load.
 */
function useFitText(key: string) {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const fit = () => {
      let f = 1;
      b.style.setProperty("--fit", "1");
      while (f > MIN_FIT && i.offsetHeight > b.clientHeight + 1) {
        f = Math.max(MIN_FIT, f - 0.05);
        b.style.setProperty("--fit", f.toFixed(2));
      }
      setOverflow(i.offsetHeight > b.clientHeight + 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [key]);
  return { box, inner, overflow };
}

/** Swallow the event so the surrounding pick button / swipe doesn't see it. */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Full text of an option in a bottom sheet, for the rare text too long for its card even at the smallest size. */
function TextSheet({
  side,
  label,
  description,
  onClose,
}: {
  side: "A" | "B";
  label: string;
  description?: string | null;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={stop}
      role="dialog"
      aria-modal="true"
      aria-label={`Option ${side}`}
    >
      <div
        className={cn(
          "optcard m-3 max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-[20px] p-5 text-left",
          side === "A" ? "optcard-a" : "optcard-b",
        )}
        onClick={stop}
      >
        <div className="optcard-badge mb-3 flex size-6 items-center justify-center rounded-full text-[12px]">
          {side}
        </div>
        <p className="optcard-label break-words text-[22px] leading-[1.15]">
          {label}
        </p>
        {description && (
          <p className="optcard-desc mt-3 break-words text-[15px] leading-snug">
            {description}
          </p>
        )}
        <button
          type="button"
          className="btn-primary mt-5 w-full"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Text-only option (no photo): the label (and a sentence or two of description) in a fun font on a
 * plain colour. Colours are fixed in `.optcard` (globals.css) so every theme reads the same.
 */
function TextFace({
  side,
  label,
  description,
  percent,
  ring,
  hot,
  className,
  big,
  compact,
  children,
}: {
  side: "A" | "B";
  label: string;
  description?: string | null;
  percent?: number | null;
  ring?: boolean;
  hot?: boolean;
  className?: string;
  big?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const isA = side === "A";
  const [open, setOpen] = useState(false);
  const { box, inner, overflow } = useFitText(
    `${label}|${description ?? ""}|${big ? 1 : 0}|${compact ? 1 : 0}`,
  );
  const labelPx = textPx(
    label.length + (description ? Math.round(description.length / 3) : 0),
    big,
  );
  const descPx = big ? 14 : 12;
  return (
    <span
      className={cn(
        "optcard relative flex h-full w-full flex-col overflow-hidden rounded-[14px] text-left transition",
        isA ? "optcard-a" : "optcard-b",
        className,
      )}
    >
      <span
        className="optcard-badge relative z-10 m-2.5 flex size-5 items-center justify-center rounded-full text-[11px]"
        aria-hidden
      >
        {side}
      </span>
      {/* Extra room on the inner edge so the deck's centred "vs" badge never covers the words.
          No line clamps: useFitText shrinks the type until the full label + description fit
          (and shows a "More" sheet as a last resort). */}
      {/* The text sits in an absolutely positioned box so it never makes the card taller than its slot. */}
      <span className="relative min-h-0 flex-1">
        <span
          ref={box}
          className={cn(
            "absolute inset-0 flex flex-col overflow-hidden pb-1",
            isA ? "pl-3.5 pr-[26px]" : "pl-[26px] pr-3.5",
          )}
        >
          <span ref={inner} className="my-auto block">
            {!compact && (
              <span
                className="optcard-label block break-words leading-[1.1]"
                style={{ fontSize: `calc(${labelPx}px * var(--fit, 1))` }}
              >
                {label}
              </span>
            )}
            {description && !compact && (
              <span
                className="optcard-desc mt-2 block break-words leading-snug"
                style={{
                  fontSize: `calc(${descPx}px * max(var(--fit, 1), 0.85))`,
                }}
              >
                {description}
              </span>
            )}
          </span>
        </span>
      </span>
      {overflow && !compact && (
        <span
          className={cn(
            "relative z-10 -mt-8 flex justify-end bg-gradient-to-t pt-6 pb-1",
            isA
              ? "from-[#c4d3ff] pl-3.5 pr-[26px]"
              : "from-[#ffcfc4] pl-[26px] pr-3.5",
          )}
        >
          <span
            role="button"
            tabIndex={0}
            data-nodrag
            className="optcard-badge rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            More
          </span>
        </span>
      )}
      {open && (
        <TextSheet
          side={side}
          label={label}
          description={description}
          onClose={() => setOpen(false)}
        />
      )}
      <span className="relative z-10 px-2.5 pb-2.5">
        {typeof percent === "number" && (
          <span
            className={cn(
              "block font-display leading-none tabular-nums",
              big ? "text-[34px]" : "text-[30px]",
            )}
          >
            {percent}%
          </span>
        )}
        {children}
      </span>
      {(ring || hot) && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-20 rounded-[14px] ring-inset",
            ring
              ? isA
                ? "ring-[2.5px] ring-a"
                : "ring-[2.5px] ring-b"
              : isA
                ? "ring-2 ring-a/60"
                : "ring-2 ring-b/60",
          )}
        />
      )}
    </span>
  );
}
