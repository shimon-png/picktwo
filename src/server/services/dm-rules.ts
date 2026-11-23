/**
 * Pure direct-message rules (no DB) — unit tested.
 *
 * How DMs work (Shimon, Nov 23 2026):
 * - Messages are OFF for everyone by default (`user.chat_enabled`). You turn them on in Settings.
 * - You can only start a DM with someone you FOLLOW ("Send DM" on their profile / in lists).
 * - Your first message is a REQUEST. The other person gets an alert ("@you, who follows you, wants to send you a
 *   message") but can't read it until they accept. They accept or decline each request one at a time, and they need
 *   messages turned on to accept. Until then you can't send more.
 * - Once accepted it's a normal chat, as long as both people keep messages on.
 */

export const DM_MAX_LENGTH = 1000;

export type ConvoStatus = "PENDING" | "ACCEPTED" | "DECLINED";

/** Conversations are stored once per pair with the ids in string order. */
export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type DmFacts = {
  self: boolean;
  meBanned: boolean;
  otherBanned: boolean;
  /** Has an email, i.e. a real account someone can sign in to (seed/demo profiles can't read messages). */
  otherReachable: boolean;
  /** A block in either direction. */
  blocked: boolean;
  meChatOn: boolean;
  otherChatOn: boolean;
  /** I follow them. Needed to start a request. */
  iFollow: boolean;
  convo: null | { status: ConvoStatus; requestedByMe: boolean };
};

/** What the viewer sees in a conversation with someone, and whether they can type. */
export type DmState =
  | { kind: "unavailable"; reason: "self" | "banned" | "not_found" | "unreachable" | "blocked" }
  /** My messages are off: turn them on first (Settings round trip). */
  | { kind: "enable_chat"; then: "send" | "accept" | "chat" }
  /** I don't follow them and there's no conversation yet. */
  | { kind: "follow_first" }
  /** Write the first message: it goes as a request. */
  | { kind: "can_request" }
  /** My request is waiting for them. */
  | { kind: "request_sent" }
  /** They want to message me: accept or decline (content hidden until accepted). */
  | { kind: "request_received" }
  /** I declined their request; I can still accept it. */
  | { kind: "declined" }
  /** Accepted, but they turned their messages off. */
  | { kind: "other_off" }
  | { kind: "chat" };

export function dmState(f: DmFacts): DmState {
  if (f.self) return { kind: "unavailable", reason: "self" };
  if (f.meBanned) return { kind: "unavailable", reason: "banned" };
  if (f.otherBanned) return { kind: "unavailable", reason: "not_found" };
  if (f.blocked) return { kind: "unavailable", reason: "blocked" };
  const c = f.convo;
  if (!c) {
    if (!f.otherReachable) return { kind: "unavailable", reason: "unreachable" };
    if (!f.iFollow) return { kind: "follow_first" };
    if (!f.meChatOn) return { kind: "enable_chat", then: "send" };
    return { kind: "can_request" };
  }
  if (c.status === "ACCEPTED") {
    if (!f.meChatOn) return { kind: "enable_chat", then: "chat" };
    if (!f.otherChatOn) return { kind: "other_off" };
    return { kind: "chat" };
  }
  if (c.requestedByMe) return { kind: "request_sent" }; // PENDING or DECLINED: the requester isn't told about a decline
  if (!f.meChatOn) return { kind: "enable_chat", then: "accept" };
  return c.status === "DECLINED" ? { kind: "declined" } : { kind: "request_received" };
}

/** Can the viewer send a message right now? (`can_request` sends the first, request message.) */
export function canType(s: DmState) {
  return s.kind === "can_request" || s.kind === "chat";
}

export const DM_UNAVAILABLE_MESSAGE: Record<Extract<DmState, { kind: "unavailable" }>["reason"], string> = {
  self: "You can't message yourself",
  banned: "Your account can't send messages",
  not_found: "That person isn't available",
  unreachable: "This person can't receive messages",
  blocked: "You can't message this person",
};

/** Error text when someone tries to send in a state where they can't. */
export function sendDeniedMessage(s: DmState, otherHandle: string): string {
  switch (s.kind) {
    case "unavailable":
      return DM_UNAVAILABLE_MESSAGE[s.reason];
    case "enable_chat":
      return "Turn on messages in Settings first";
    case "follow_first":
      return `Follow @${otherHandle} to send them a DM`;
    case "request_sent":
      return `Waiting for @${otherHandle} to accept your message request`;
    case "request_received":
    case "declined":
      return "Accept their message request first";
    case "other_off":
      return `@${otherHandle} has turned off messages`;
    default:
      return "You can't send a message right now";
  }
}
