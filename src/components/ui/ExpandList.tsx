"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExpandItem = { key: string; /** What the search box matches against. */ text: string; node: React.ReactNode };

/**
 * Shows the first `initial` items with "Show more", plus a search box whenever there's more than one item.
 * While searching, every match shows.
 */
export function ExpandList({
  items,
  initial = 5,
  searchPlaceholder = "Search",
  empty,
  className,
}: {
  items: ExpandItem[];
  initial?: number;
  searchPlaceholder?: string;
  empty?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matches = useMemo(() => (query ? items.filter((i) => i.text.toLowerCase().includes(query)) : items), [items, query]);
  if (!items.length) return empty ? <>{empty}</> : null;
  const shown = query || open ? matches : matches.slice(0, initial);
  const hidden = matches.length - shown.length;
  return (
    <div className="space-y-2">
      {items.length > 1 && (
        <label className="relative block">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="input !rounded-full !py-2 !pl-9" />
        </label>
      )}
      {shown.length ? (
        <ul className={cn("space-y-2", className)}>
          {shown.map((i) => (
            <li key={i.key}>{i.node}</li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-sm text-zinc-500">No matches.</p>
      )}
      {!query && (hidden > 0 || open) && items.length > initial && (
        <button type="button" onClick={() => setOpen(!open)} className="w-full rounded-full py-2 text-[13px] font-medium text-accent hover:bg-surface">
          {open ? "Show less" : `Show more (${hidden})`}
        </button>
      )}
    </div>
  );
}
