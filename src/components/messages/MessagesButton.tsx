"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Header shortcut to the inbox with an unread badge. */
export function MessagesButton({ unread }: { unread: number }) {
  const path = usePathname();
  const active = path.startsWith("/messages");
  return (
    <Link
      href="/messages"
      aria-label={`Messages${unread ? `, ${unread} unread` : ""}`}
      aria-current={active ? "page" : undefined}
      className={cn("relative flex size-9 items-center justify-center rounded-full text-ink hover:bg-surface", active && "bg-surface")}
    >
      <MessageCircle className="size-[22px]" aria-hidden />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border-2 border-page bg-b px-1 text-center text-[10px] font-semibold leading-[14px] text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
