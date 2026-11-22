"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, Layers, PlusSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

/** Full-screen flows hide the app chrome (header + tab bar). */
export function isFullScreen(path: string) {
  return path.startsWith("/post") || /^\/b\/[^/]+\/report/.test(path);
}

/** The logged-out homepage is a landing page: no desktop sidebar. */
export function hidesSidebar(path: string) {
  return path === "/";
}

/** Page wrapper that leaves room for the desktop sidebar (except where it's hidden). */
export function ContentShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div className={hidesSidebar(path) ? undefined : "md:pl-56"}>{children}</div>;
}

/** Header logo: on desktop the sidebar shows the logo, so the header hides its copy unless there's no sidebar. */
export function HeaderLogo() {
  const path = usePathname();
  return <Logo className={hidesSidebar(path) ? undefined : "md:invisible"} />;
}

/** Renders children unless the current route is a full-screen flow. */
export function ChromeOnly({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return isFullScreen(path) ? null : <>{children}</>;
}

/** Text fields that bring up the on-screen keyboard (not checkboxes, radios, buttons…). */
function isTextField(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image", "hidden"].includes(el.type);
}

/**
 * True while a text field is focused on a touch device, i.e. the keyboard is up. iOS Safari keeps
 * `position: fixed` bars pinned to the layout viewport, so the tab bar would float above the keyboard
 * with the page scrolling behind it; we hide it instead.
 */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const onIn = (e: FocusEvent) => isTextField(e.target) && setOpen(true);
    // focusout fires before focus moves to the next field; re-check on the next tick.
    const onOut = () => setTimeout(() => setOpen(isTextField(document.activeElement)), 0);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return open;
}

export function Nav() {
  const path = usePathname();
  const keyboard = useKeyboardOpen();
  if (isFullScreen(path) || keyboard) return null;
  // "You" lives in the header (avatar, top right); the tab bar is Vote · Post · Discover.
  const items: { href: string; label: string; icon: typeof Layers; badge?: number; match: (p: string) => boolean }[] = [
    { href: "/vote", label: "Vote", icon: Layers, match: (p: string) => p.startsWith("/vote") || p === "/" },
    { href: "/post", label: "Post", icon: PlusSquare, match: (p: string) => p.startsWith("/post") },
    { href: "/discover", label: "Discover", icon: Compass, match: (p: string) => p.startsWith("/discover") || p.startsWith("/u/") },
  ];
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:w-56 md:border-r md:border-t-0 md:pt-5",
        hidesSidebar(path) && "md:hidden",
      )}
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
                data-tour={`nav-${it.label.toLowerCase()}`}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2 text-[13px] font-medium text-zinc-500 md:flex-row md:gap-3 md:rounded-lg md:px-3 md:text-[15px]",
                  active && "text-ink md:bg-surface",
                )}
              >
                <Icon className={cn("size-[26px] stroke-[2.1] md:size-5 md:stroke-2", active && "stroke-[2.5] md:stroke-[2.25]")} aria-hidden />
                <span className="leading-none md:leading-normal">{it.label}</span>
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

/** Header avatar (top right): opens You. A red count shows unread updates. */
export function YouButton({ name, image, unread }: { name: string; image: string | null; unread: number }) {
  const path = usePathname();
  const active = ["/you", "/priority", "/activity", "/settings"].some((x) => path.startsWith(x));
  return (
    <Link
      href="/you"
      data-tour="nav-you"
      aria-label={`You${unread ? `, ${unread} new updates` : ""}`}
      aria-current={active ? "page" : undefined}
      className={cn("relative block rounded-full ring-2 ring-transparent transition", active && "ring-ink")}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-9 rounded-full bg-surface object-cover" />
      ) : (
        <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-a to-b text-[15px] font-medium text-white" aria-hidden>
          {(name.replace(/^@/, "")[0] ?? "?").toUpperCase()}
        </span>
      )}
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border-2 border-page bg-b px-1 text-center text-[10px] font-semibold leading-[14px] text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
