"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, PlusSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

/** Full-screen flows hide the app chrome (header + tab bar). */
export function isFullScreen(path: string) {
  return path.startsWith("/post") || /^\/b\/[^/]+\/(report|published)/.test(path);
}

/** Renders children unless the current route is a full-screen flow. */
export function ChromeOnly({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return isFullScreen(path) ? null : <>{children}</>;
}

export function Nav({ unread }: { unread: number }) {
  const path = usePathname();
  if (isFullScreen(path)) return null;
  const items = [
    { href: "/vote", label: "Vote", icon: Layers, match: (p: string) => p.startsWith("/vote") || p === "/" },
    { href: "/post", label: "Post", icon: PlusSquare, match: (p: string) => p.startsWith("/post") },
    {
      href: "/you",
      label: "You",
      icon: User,
      badge: unread,
      match: (p: string) => ["/you", "/priority", "/activity", "/settings", "/u/"].some((x) => p.startsWith(x)),
    },
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:w-56 md:border-r md:border-t-0 md:pt-5"
    >
      <div className="mb-6 hidden px-5 md:block">
        <Logo />
      </div>
      <ul className="mx-auto flex max-w-lg items-center justify-around md:flex-col md:items-stretch md:gap-1 md:px-3">
        {items.map((it) => {
          const active = it.match(path);
          const Icon = it.icon;
          return (
            <li key={it.label} className="flex-1 md:flex-none">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 text-xs text-zinc-500 md:flex-row md:gap-3 md:rounded-lg md:px-3 md:text-[15px]",
                  active && "text-pink md:bg-pink-soft",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.25]")} aria-hidden />
                <span>{it.label}</span>
                {!!it.badge && (
                  <span className="absolute left-1/2 top-1 ml-2 min-w-4 rounded-full bg-b px-1 text-center text-[10px] font-medium text-white md:static md:ml-auto">
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
