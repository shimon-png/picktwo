"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string; badge?: "flagged" | "unread" }[] = [
  { href: "/admin/brain", label: "Brain" },
  { href: "/admin/journey", label: "Journey" },
  { href: "/admin/comments", label: "Comments" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/reports", label: "Moderation", badge: "flagged" },
  { href: "/admin/battles", label: "Battles" },
  { href: "/admin/messages", label: "Messages", badge: "unread" },
  { href: "/admin/config", label: "Config" },
];

/** True when `path` is that tab's page or one of its sub-pages (a Brain list, a Journey person). */
export function isActiveTab(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

/** Admin top bar; the tab you're on is filled in (Alex, Nov 26 2026). */
export function AdminNav({ flagged, unread }: { flagged: number; unread: number }) {
  const path = usePathname() ?? "";
  const counts = { flagged, unread };
  return (
    // A div, not <nav>: the Arcade theme paints `nav a[aria-current]` lime text, which vanishes on the lime chip-on.
    <div role="navigation" className="flex flex-wrap items-center gap-2" aria-label="Admin sections">
      <h1 className="mr-2 text-xl font-medium">Admin</h1>
      {TABS.map((t) => {
        const on = isActiveTab(path, t.href);
        const n = t.badge ? counts[t.badge] : 0;
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`chip ${on ? "chip-on" : ""}`}>
            {t.label}
            {n > 0 && <span className="ml-1.5 rounded-full bg-b px-1.5 text-[11px] text-white">{n}</span>}
          </Link>
        );
      })}
      <a href="/api/admin/export" className="chip">Export JSONL</a>
    </div>
  );
}
