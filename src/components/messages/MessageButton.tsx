import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Message" link to a conversation. `small` is the icon-only version for list rows. */
export function MessageButton({ handle, small, className }: { handle: string; small?: boolean; className?: string }) {
  return small ? (
    <Link
      href={`/messages/${handle}`}
      aria-label={`Message @${handle}`}
      className={cn("relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink hover:bg-surface", className)}
    >
      <MessageCircle className="size-4" aria-hidden />
    </Link>
  ) : (
    <Link href={`/messages/${handle}`} className={cn("btn-outline", className)}>
      <MessageCircle className="size-4" aria-hidden /> Message
    </Link>
  );
}
