"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Flag, MoreHorizontal, Send } from "lucide-react";
import { api, toast } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import type { DmView, ThreadPerson } from "@/server/services/messages";

const REPORT_REASONS = [
  ["harassment", "Harassment or hate"],
  ["inappropriate", "Sexual or inappropriate"],
  ["spam", "Spam or scam"],
  ["minor_safety", "Child safety concern"],
  ["other", "Something else"],
] as const;

export function Thread({
  other,
  initial,
  canSend: canSendInitial,
  notice: noticeInitial,
  iBlocked: iBlockedInitial,
}: {
  other: ThreadPerson;
  initial: DmView[];
  canSend: boolean;
  notice: string | null;
  iBlocked: boolean;
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [canSend, setCanSend] = useState(canSendInitial);
  const [notice, setNotice] = useState(noticeInitial);
  const [menu, setMenu] = useState(false);
  const [iBlocked, setIBlocked] = useState(iBlockedInitial);
  const [reporting, setReporting] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const last = msgs[msgs.length - 1]?.createdAt;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const r = await api<{ messages: DmView[]; canSend: boolean; notice: string | null }>(
        `/api/messages/${other.handle}${last ? `?after=${encodeURIComponent(last)}` : ""}`,
      );
      if (r.messages.length) setMsgs((m) => [...m, ...r.messages.filter((x) => !m.some((y) => y.id === x.id))]);
      setCanSend(r.canSend);
      setNotice(r.notice);
    } catch {}
  }, [other.handle, last]);

  useEffect(() => {
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const r = await api<{ message: DmView }>("/api/messages", { body: { to: other.handle, body } });
      setMsgs((m) => [...m, r.message]);
      setDraft("");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    setMenu(false);
    const on = !iBlocked;
    if (on && !window.confirm(`Block @${other.handle}? They won't be able to message you, and you won't see each other in "Voted like you".`)) return;
    try {
      await api(`/api/block/${other.id}`, { method: on ? "POST" : "DELETE" });
      toast(on ? "Blocked" : "Unblocked", "ok");
      setIBlocked(on);
      if (on) {
        router.push("/messages");
        router.refresh();
      } else await poll();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function report(messageId: string, reason: string) {
    try {
      await api("/api/messages/report", { body: { messageId, reason } });
      toast("Thanks — our team will review it");
    } catch (err) {
      toast((err as Error).message, "error");
    }
    setReporting(null);
  }

  const theirs = msgs.filter((m) => !m.mine);

  return (
    <div className="-mx-4 -mt-2 flex h-[calc(100dvh-4rem-4.5rem)] flex-col md:h-[calc(100dvh-4rem)]">
      <div className="flex items-center gap-2 border-b border-ink/10 px-2 py-2">
        <Link href="/messages" className="rounded-full p-2 hover:bg-surface" aria-label="Back to messages">
          <ArrowLeft className="size-5" />
        </Link>
        <Link href={`/u/${other.handle}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={other.name || other.handle} seed={other.handle} src={other.image} size={36} className="text-sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{other.name || `@${other.handle}`}</span>
            <span className="block truncate text-xs text-zinc-500">@{other.handle}</span>
          </span>
        </Link>
        <div className="relative">
          <button className="rounded-full p-2 hover:bg-surface" aria-label="Conversation options" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <MoreHorizontal className="size-5" />
          </button>
          {menu && (
            <div className="card absolute right-0 top-full z-30 mt-1 w-56 p-1.5 shadow-lift" role="menu">
              {theirs.length > 0 && (
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface"
                  onClick={() => {
                    setMenu(false);
                    setReporting(theirs[theirs.length - 1].id);
                  }}
                >
                  <Flag className="size-4" /> Report latest message
                </button>
              )}
              <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-b hover:bg-surface" onClick={block}>
                <Ban className="size-4" /> {iBlocked ? "Unblock" : "Block"} @{other.handle}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite">
        {msgs.length === 0 && (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-zinc-500">
            Say hi to {other.name || `@${other.handle}`}. Keep it kind — people can block and report messages.
          </p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={cn("group flex flex-col", m.mine ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px]",
                m.mine ? "rounded-br-md bg-ink text-page" : "rounded-bl-md bg-surface text-ink",
              )}
            >
              {m.body}
            </div>
            <div className="mt-0.5 flex items-center gap-2 px-1 text-[11px] text-zinc-400">
              {timeAgo(m.createdAt)}
              {!m.mine && (
                <button className="hover:text-b" onClick={() => setReporting(m.id)} aria-label="Report this message">
                  Report
                </button>
              )}
            </div>
            {reporting === m.id && (
              <div className="card mt-1 w-60 p-1.5 shadow-lift" role="menu">
                <p className="px-3 py-1.5 text-xs text-zinc-500">Why are you reporting this?</p>
                {REPORT_REASONS.map(([id, label]) => (
                  <button key={id} role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface" onClick={() => report(m.id, id)}>
                    {label}
                  </button>
                ))}
                <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-surface" onClick={() => setReporting(null)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      {canSend ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-ink/10 px-3 py-2.5">
          <textarea
            className="input max-h-32 min-h-[44px] flex-1 resize-none !rounded-2xl !py-2.5"
            rows={1}
            maxLength={1000}
            placeholder="Message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            aria-label={`Message @${other.handle}`}
          />
          <button className="btn-primary size-11 shrink-0 !p-0" disabled={busy || !draft.trim()} aria-label="Send">
            <Send className="size-4" />
          </button>
        </form>
      ) : (
        <p className="border-t border-ink/10 px-4 py-3 text-center text-sm text-zinc-500">{notice ?? "You can't reply to this conversation."}</p>
      )}
    </div>
  );
}
