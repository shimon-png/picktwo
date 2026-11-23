"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Flag, MoreHorizontal, Send } from "lucide-react";
import { api, toast } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import type { DmView, ThreadPerson } from "@/server/services/messages";
import type { DmState } from "@/server/services/dm-rules";

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
  state: stateInitial,
  iBlocked: iBlockedInitial,
}: {
  other: ThreadPerson;
  initial: DmView[];
  state: DmState;
  iBlocked: boolean;
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(stateInitial);
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
      const r = await api<{ messages: DmView[]; state: DmState }>(`/api/messages/${other.handle}${last ? `?after=${encodeURIComponent(last)}` : ""}`);
      if (r.messages.length) setMsgs((m) => [...m, ...r.messages.filter((x) => !m.some((y) => y.id === x.id))]);
      setState(r.state);
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
      const r = await api<{ message: DmView; requested: boolean }>("/api/messages", { body: { to: other.handle, body } });
      setMsgs((m) => [...m, r.message]);
      setDraft("");
      if (r.requested) {
        setState({ kind: "request_sent" });
        toast(`Request sent to @${other.handle}`, "ok");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      await api(`/api/messages/${other.handle}/respond`, { body: { accept } });
      if (accept) {
        toast("Request accepted", "ok");
        await poll();
      } else {
        toast("Request declined");
        router.push("/messages");
        router.refresh();
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function follow() {
    setBusy(true);
    try {
      await api(`/api/follow/${other.id}`, { method: "POST" });
      await poll();
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
              {theirs.length > 0 && (state.kind === "chat" || state.kind === "other_off") && (
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
        {msgs.length === 0 && state.kind === "can_request" && (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-zinc-500">
            Your first message goes to {other.name || `@${other.handle}`} as a request. They’ll see that you want to message them and can accept it.
          </p>
        )}
        <StatePanel state={state} other={other} busy={busy} onRespond={respond} onFollow={follow} />
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

      {state.kind === "can_request" || state.kind === "chat" ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-ink/10 px-3 py-2.5">
          <textarea
            className="input max-h-32 min-h-[44px] flex-1 resize-none !rounded-2xl !py-2.5"
            rows={1}
            maxLength={1000}
            placeholder={state.kind === "can_request" ? "Write your message request…" : "Message…"}
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
        <p className="border-t border-ink/10 px-4 py-3 text-center text-sm text-zinc-500">{iBlocked ? "You blocked this person. Unblock them to send a message." : footerNote(state, other.handle)}</p>
      )}
    </div>
  );
}

const settingsHref = (handle: string) => `/settings?enable=chat&returnTo=${encodeURIComponent(`/messages/${handle}`)}`;

function footerNote(state: DmState, handle: string) {
  switch (state.kind) {
    case "request_sent":
      return `Request sent. You can send more once @${handle} accepts.`;
    case "request_received":
    case "declined":
      return "Accept the request to read it and reply.";
    case "enable_chat":
      return "Messages are off for you.";
    case "follow_first":
      return `Follow @${handle} to send a DM.`;
    case "other_off":
      return `@${handle} has turned off messages.`;
    case "unavailable":
      return state.reason === "blocked" ? "You can’t message this person." : state.reason === "unreachable" ? "This person can’t receive messages." : "This conversation isn’t available.";
    default:
      return "";
  }
}

/** The card in the middle of the thread for every state that needs a decision. */
function StatePanel({
  state,
  other,
  busy,
  onRespond,
  onFollow,
}: {
  state: DmState;
  other: ThreadPerson;
  busy: boolean;
  onRespond: (accept: boolean) => void;
  onFollow: () => void;
}) {
  const who = other.name || `@${other.handle}`;
  const card = "card mx-auto mt-6 max-w-sm space-y-3 p-5 text-center";
  if (state.kind === "enable_chat") {
    const what =
      state.then === "send" ? `send ${who} a DM` : state.then === "accept" ? `see ${who}’s message request` : `keep chatting with ${who}`;
    return (
      <div className={card}>
        <p className="text-[15px]">
          {state.then === "accept" ? (
            <>
              <b className="font-medium">{who}</b>, who follows you, wants to send you a message. Do you want to receive messages?
            </>
          ) : (
            <>Turn on messages to {what}.</>
          )}
        </p>
        <Link href={settingsHref(other.handle)} className="btn-primary w-full">
          {state.then === "accept" ? "Yes, turn on messages" : "Turn on messages"}
        </Link>
        <p className="text-xs text-zinc-500">Messages are off by default. You’ll come right back here.</p>
      </div>
    );
  }
  if (state.kind === "request_received" || state.kind === "declined")
    return (
      <div className={card}>
        <p className="text-[15px]">
          <b className="font-medium">{who}</b>, who follows you, wants to send you a message.
        </p>
        {state.kind === "declined" && <p className="text-sm text-zinc-500">You declined this request.</p>}
        <p className="text-sm text-zinc-500">You’ll see it once you accept. They won’t be told if you decline.</p>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy} onClick={() => onRespond(true)}>
            Accept
          </button>
          {state.kind === "request_received" && (
            <button className="btn-outline flex-1" disabled={busy} onClick={() => onRespond(false)}>
              Decline
            </button>
          )}
        </div>
      </div>
    );
  if (state.kind === "follow_first")
    return (
      <div className={card}>
        <p className="text-[15px]">You can send a DM to people you follow.</p>
        <button className="btn-primary w-full" disabled={busy} onClick={onFollow}>
          Follow @{other.handle}
        </button>
      </div>
    );
  return null;
}
