"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Plus, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav({ handle, unread }: { handle: string | null; unread: number }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { href: "/vote", label: "Vote", icon: Layers, match: (p: string) => p.startsWith("/vote") },
    { href: "/post", label: "Post", icon: Plus, primary: true, match: (p: string) => p.startsWith("/post") },
    { href: "/activity", label: "Activity", icon: Bell, badge: unread, match: (p: string) => p.startsWith("/activity") },
    { href: handle ? `/u/${handle}` : "/signin", label: "Profile", icon: User, match: (p: string) => p.startsWith("/u/") || p.startsWith("/settings") },
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:w-56 md:border-r md:border-t-0 md:pt-20 dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around md:flex-col md:items-stretch md:gap-1 md:px-3">
        {items.map((it) => {
          const active = it.match(path);
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <Link
                href={it.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-medium text-zinc-500 md:flex-row md:gap-3 md:rounded-xl md:text-sm",
                  active && "text-zinc-900 dark:text-white md:bg-zinc-100 dark:md:bg-zinc-800",
                )}
              >
                {it.primary ? (
                  <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-a to-b text-white shadow md:size-8">
                    <Icon className="size-5" />
                  </span>
                ) : (
                  <Icon className={cn("size-6 md:size-5", active && "stroke-[2.5]")} />
                )}
                <span className={cn(it.primary && "md:font-semibold", it.primary && "sr-only md:not-sr-only")}>{it.label}</span>
                {!!it.badge && (
                  <span className="absolute right-2 top-1 min-w-4 rounded-full bg-b px-1 text-center text-[10px] font-bold text-white md:static md:ml-auto">
                    {it.badge > 9 ? "9+" : it.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
