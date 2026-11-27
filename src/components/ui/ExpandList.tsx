"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExpandItem = {
  key: string;
  /** What the search box matches against. */
  text: string;
  node: React.ReactNode;
  /** With `sections`, the heading this item sits under. */
  section?: string;
};

/**
 * Shows the first `initial` items with "Show more", plus a search box whenever there's more than one item.
 * While searching, every match shows.
 * With `sections`, items are grouped under those headings (in that order, empty ones hidden); one search box covers all,
 * and each section shows its first `initial` items.
 */
export function ExpandList({
  items,
  initial = 5,
  searchPlaceholder = "Search",
  empty,
  className,
  sections,
}: {
  items: ExpandItem[];
  initial?: number;
  searchPlaceholder?: string;
  empty?: React.ReactNode;
  className?: string;
  sections?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matches = useMemo(() => (query ? items.filter((i) => i.text.toLowerCase().includes(query)) : items), [items, query]);
  if (!items.length) return empty ? <>{empty}</> : null;
  const all = query || open;
  const groups = (sections ?? [undefined]).map((title) => {
    const inGroup = sections ? matches.filter((i) => i.section === title) : matches;
    return { title, items: all ? inGroup : inGroup.slice(0, initial), total: inGroup.length };
  });
  const shownCount = groups.reduce((n, g) => n + g.items.length, 0);
  const hidden = matches.length - shownCount;
  const list = (rows: ExpandItem[]) => (
    <ul className={cn("space-y-2", className)}>
      {rows.map((i) => (
        <li key={i.key}>{i.node}</li>
      ))}
    </ul>
  );
  return (
    <div className="space-y-2">
      {items.length > 1 && (
        <label className="relative block">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="input !rounded-full !py-2 !pl-9" />
        </label>
      )}
      {shownCount ? (
        groups
          .filter((g) => g.items.length)
          .map((g) =>
            g.title ? (
              <div key={g.title}>
                <h3 className="mb-1 mt-3 font-sans text-[13px] font-semibold uppercase tracking-wide text-ink">
                  {g.title} <span className="font-normal">· {g.total}</span>
                </h3>
                {list(g.items)}
              </div>
            ) : (
              <div key="all">{list(g.items)}</div>
            ),
          )
      ) : (
        <p className="px-1 py-2 text-sm text-zinc-500">No matches.</p>
      )}
      {!query && (hidden > 0 || (open && groups.some((g) => g.total > initial))) && (
        <button type="button" onClick={() => setOpen(!open)} className="w-full rounded-full py-2 text-[13px] font-medium text-accent hover:bg-surface">
          {open ? "Show less" : `Show more (${hidden})`}
        </button>
      )}
    </div>
  );
}
