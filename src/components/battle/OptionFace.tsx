/* eslint-disable @next/next/no-img-element */
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
 * The visual face of an option tile: photo / link preview if present, otherwise a tinted gradient
 * (blue for A, coral for B) with the A/B badge and name. Percent overlays after a vote.
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
}) {
  const isA = side === "A";
  return (
    <span
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-lg text-left transition",
        isA ? "bg-gradient-to-b from-a-soft to-white" : "bg-gradient-to-b from-b-soft to-white",
        className,
      )}
    >
      {image && <img src={image} alt="" className="absolute inset-0 size-full object-cover" draggable={false} loading="lazy" />}
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
      <span className={cn("relative z-10 px-2.5 pb-2.5", image && "bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-10")}>
        {typeof percent === "number" && (
          <span
            className={cn(
              "block font-medium leading-none tabular-nums tracking-tight",
              big ? "text-[26px]" : "text-2xl",
              image ? "text-white" : isA ? "text-ink" : "text-b",
            )}
          >
            {percent}%
          </span>
        )}
        <span className={cn("mt-1 line-clamp-2 block text-[13px]", image ? "text-white" : "text-ink")}>{label}</span>
        {description && (
          <span className={cn("mt-0.5 line-clamp-2 block text-[11px] leading-snug", image ? "text-white/80" : "text-zinc-500")}>{description}</span>
        )}
      </span>
      {(ring || hot) && (
        <span
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 z-20 rounded-lg ring-inset", ring ? "ring-2 ring-accent" : isA ? "ring-2 ring-a/60" : "ring-2 ring-b/60")}
        />
      )}
    </span>
  );
}
