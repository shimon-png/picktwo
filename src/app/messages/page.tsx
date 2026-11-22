import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { listConversations } from "@/server/services/messages";
import { Avatar } from "@/components/ui/Avatar";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/messages");
  if (profileIncomplete(user)) redirect(onboardingUrl("/messages"));
  const list = await listConversations(user);
  return (
    <div className="space-y-5">
      <header className="pt-1">
        <h1 className="text-[32px] leading-none">Messages</h1>
      </header>
      {list.length === 0 ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-[15px]">No messages yet.</p>
          <p className="text-sm text-zinc-500">Find people who vote like you and say hi.</p>
          <Link href="/people-like-you" className="btn-primary">
            People who vote like you
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-ink/8 overflow-hidden">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.other.handle}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
                <Avatar name={c.other.name || c.other.handle} seed={c.other.handle} src={c.other.image} size={44} className="text-base" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate", c.unread > 0 && "font-semibold")}>{c.other.name || `@${c.other.handle}`}</span>
                    {c.last && <span className="shrink-0 text-xs text-zinc-400">{timeAgo(c.last.createdAt)}</span>}
                  </span>
                  <span className={cn("block truncate text-sm", c.unread > 0 ? "text-ink" : "text-zinc-500")}>
                    {c.last ? `${c.last.mine ? "You: " : ""}${c.last.body}` : "No messages yet"}
                  </span>
                </span>
                {c.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-b px-1.5 text-[11px] text-white" aria-label={`${c.unread} unread`}>
                    {c.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
