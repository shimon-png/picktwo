/* eslint-disable @next/next/no-img-element */
import { Check, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";

export type OptionData = {
  id: string;
  side: "A" | "B";
  label: string;
  imageUrl: string | null;
  url: string | null;
  urlImage: string | null;
  priceCents: number | null;
  currency: string | null;
};

export function OptionTile({
  option,
  percent,
  selected,
  winner,
  picked,
  thumb,
  onClick,
  disabled,
  compact,
}: {
  option: OptionData;
  percent?: number | null;
  selected?: boolean;
  winner?: boolean;
  picked?: boolean;
  thumb?: "UP" | "DOWN" | null;
  onClick?: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const img = option.imageUrl || option.urlImage;
  const isA = option.side === "A";
  const price = formatPrice(option.priceCents, option.currency);
  const showResult = typeof percent === "number";
  const Comp = onClick ? "button" : "div";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Comp
        type={onClick ? "button" : undefined}
        onClick={onClick}
        disabled={onClick ? disabled : undefined}
        aria-label={onClick ? `Vote for ${option.label}` : undefined}
        aria-pressed={onClick ? !!selected : undefined}
        className={cn(
          "group relative flex aspect-square w-full flex-col overflow-hidden rounded-2xl border-2 text-left transition",
          isA ? "border-a/25 bg-a-soft dark:bg-a/15" : "border-b/25 bg-b-soft dark:bg-b/15",
          onClick && !disabled && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]",
          selected && (isA ? "border-a ring-4 ring-a/25" : "border-b ring-4 ring-b/25"),
          compact && "aspect-[4/3]",
        )}
      >
        {img ? (
          <img src={img} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex flex-1 items-center justify-center p-4 text-center">
            <span className={cn("font-display font-extrabold leading-tight", compact ? "text-lg" : "text-xl sm:text-2xl", isA ? "text-a" : "text-b")}>
              {option.label}
            </span>
          </div>
        )}
        <span
          className={cn(
            "absolute left-2 top-2 flex size-7 items-center justify-center rounded-full text-sm font-extrabold text-white shadow",
            isA ? "bg-a" : "bg-b",
          )}
          aria-hidden
        >
          {option.side}
        </span>
        {picked && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-ok px-2 py-1 text-xs font-bold text-white shadow">
            <Check className="size-3.5" /> Picked
            {thumb === "UP" && <ThumbsUp className="size-3.5" />}
            {thumb === "DOWN" && <ThumbsDown className="size-3.5" />}
          </span>
        )}
        {showResult && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
            <div className="font-display text-3xl font-extrabold text-white tabular-nums">{percent}%</div>
          </div>
        )}
      </Comp>
      <div className="flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          {img && <div className={cn("truncate font-semibold", compact ? "text-sm" : "text-[15px]")}>{option.label}</div>}
          {price && <div className="text-xs text-zinc-500">{price}</div>}
        </div>
        {option.url && !compact && (
          <a
            href={`/go/${option.id}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            aria-label={`Open link for ${option.label}`}
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
      {showResult && (
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", isA ? "bg-a" : "bg-b", winner && "brightness-110")}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
