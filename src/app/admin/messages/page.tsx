import Link from "next/link";
import { listContactMessages, topicLabel, type ContactStatus } from "@/server/services/contact";
import { MessageActions } from "@/components/admin/AdminActions";
import { timeAgo } from "@/lib/utils";

const TABS: [ContactStatus | "ALL", string][] = [
  ["NEW", "New"],
  ["HANDLED", "Handled"],
  ["ALL", "All"],
];

export default async function AdminMessages({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams;
  const status = (TABS.find(([k]) => k === raw)?.[0] ?? "NEW") as ContactStatus | "ALL";
  const rows = await listContactMessages(status);
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/messages?status=${k}`} className={`chip !py-1 text-xs ${k === status ? "chip-on" : ""}`}>
            {label}
          </Link>
        ))}
      </div>
      {!rows.length ? (
        <p className="text-zinc-500">{status === "NEW" ? "No new messages 🎉" : "Nothing here yet."}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li key={m.id} className={`card space-y-2 p-3 ${m.status === "NEW" ? "" : "opacity-70"} ${m.topic === "safety" && m.status === "NEW" ? "border-red-400" : ""}`}>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-500">
                <span className={m.topic === "safety" ? "font-medium text-red-600" : ""}>
                  {topicLabel(m.topic)}
                  {m.status === "NEW" && <span className="ml-2 rounded-full bg-b px-1.5 text-[11px] text-white">new</span>}
                </span>
                <span title={m.createdAt.toISOString()}>{timeAgo(m.createdAt)}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium">{m.name || "(no name)"}</span>{" "}
                <a className="text-accent underline" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to crowdpick.ai")}`}>
                  {m.email}
                </a>
                {m.userId && <span className="ml-1 text-xs text-zinc-400">(signed in)</span>}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">{m.message}</p>
              {m.pageUrl && <div className="truncate text-xs text-zinc-400">Came from: {m.pageUrl}</div>}
              <MessageActions id={m.id} status={m.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
