import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { listInbox, type InboxRow } from "@/server/services/messages";
import { Avatar } from "@/components/ui/Avatar";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/messages");
  if (profileIncomplete(user)) redirect(onboardingUrl("/messages"));
  const inbox = await listInbox(user);
  const requests = inbox.filter((r) => r.kind === "request");
  const chats = inbox.filter((r) => r.kind !== "request");
  const settingsHref = `/settings?enable=chat&returnTo=${encodeURIComponent("/messages")}`;

  return (
    <div className="space-y-6">
      <header className="pt-1">
        <h1 className="text-[32px] leading-none">Messages</h1>
      </header>

      {!user.chatEnabled && (
        <div className="card space-y-3 p-5">
          {requests.length > 0 ? (
            <p className="text-[15px]">
              <b className="font-medium">
                {requests.length} {requests.length === 1 ? "person who follows you wants" : "people who follow you want"}
              </b>{" "}
              to send you a message. Do you want to receive messages?
            </p>
          ) : (
            <p className="text-[15px]">Messages are off. Turn them on to send DMs to people you follow and accept message requests.</p>
          )}
          <Link href={settingsHref} className="btn-primary">
            {requests.length > 0 ? "Yes, turn on messages" : "Turn on messages"}
          </Link>
          <p className="text-xs text-zinc-500">Nobody can message you without your OK: you accept each request one at a time.</p>
        </div>
      )}

      {requests.length > 0 && (
        <section>
          <h2 className="mb-2 text-[22px]">
            Message requests <span className="font-sans text-sm text-zinc-500">{requests.length}</span>
          </h2>
          <ul className="card divide-y divide-ink/8 overflow-hidden">
            {requests.map((r) => (
              <Row key={r.id} r={r} sub={<>Follows you · wants to send you a message</>} />
            ))}
          </ul>
        </section>
      )}

      <section>
        {requests.length > 0 && <h2 className="mb-2 text-[22px]">Chats</h2>}
        {chats.length === 0 ? (
          <div className="card space-y-2 p-6 text-center">
            <p className="text-[15px]">No messages yet.</p>
            <p className="text-sm text-zinc-500">Follow someone, then tap “Send DM” on their profile.</p>
            <Link href="/people-like-you" className="btn-outline">
              People who vote like you
            </Link>
          </div>
        ) : (
          <ul className="card divide-y divide-ink/8 overflow-hidden">
            {chats.map((r) => (
              <Row
                key={r.id}
                r={r}
                sub={r.kind === "sent" ? <>Request sent · waiting for them to accept</> : r.last ? `${r.last.mine ? "You: " : ""}${r.last.body}` : "No messages yet"}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ r, sub }: { r: InboxRow; sub: React.ReactNode }) {
  const bold = r.unread > 0 || r.kind === "request";
  return (
    <li>
      <Link href={`/messages/${r.other.handle}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
        <Avatar name={r.other.name || r.other.handle} seed={r.other.handle} src={r.other.image} size={44} className="text-base" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate", bold && "font-semibold")}>{r.other.name || `@${r.other.handle}`}</span>
            {r.last && <span className="shrink-0 text-xs text-zinc-400">{timeAgo(r.last.createdAt)}</span>}
          </span>
          <span className={cn("block truncate text-sm", bold ? "text-ink" : "text-zinc-500")}>{sub}</span>
        </span>
        {r.kind === "request" ? (
          <span className="shrink-0 rounded-full bg-b px-2 py-0.5 text-[11px] text-white">New</span>
        ) : (
          r.unread > 0 && (
            <span className="shrink-0 rounded-full bg-b px-1.5 text-[11px] text-white" aria-label={`${r.unread} unread`}>
              {r.unread}
            </span>
          )
        )}
      </Link>
    </li>
  );
}
