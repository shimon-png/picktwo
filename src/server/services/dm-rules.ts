/** Pure direct-message rules (no DB) — unit tested. */

export type DmPolicy = "EVERYONE" | "FOLLOWING" | "NOBODY";
export const DM_POLICIES: DmPolicy[] = ["EVERYONE", "FOLLOWING", "NOBODY"];
export const DM_MAX_LENGTH = 1000;

/** Conversations are stored once per pair with the ids in string order. */
export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type DmCheck = {
  senderBanned: boolean;
  recipientExists: boolean;
  recipientBanned: boolean;
  /** Has an email, i.e. a real account someone can sign in to (seed/demo profiles can't read messages). */
  recipientReachable: boolean;
  blocked: boolean;
  recipientPolicy: DmPolicy;
  recipientFollowsSender: boolean;
  /** The recipient already wrote to the sender in this conversation: replying is always allowed. */
  recipientWroteFirst: boolean;
  self: boolean;
};

export type DmDenied = "self" | "banned" | "not_found" | "unreachable" | "blocked" | "policy";

/** Can `sender` message `recipient`? The recipient's policy only limits who can START; replies are always fine. */
export function canSendDm(c: DmCheck): { ok: true } | { ok: false; reason: DmDenied } {
  if (c.self) return { ok: false, reason: "self" };
  if (c.senderBanned) return { ok: false, reason: "banned" };
  if (!c.recipientExists || c.recipientBanned) return { ok: false, reason: "not_found" };
  if (!c.recipientReachable) return { ok: false, reason: "unreachable" };
  if (c.blocked) return { ok: false, reason: "blocked" };
  if (c.recipientWroteFirst) return { ok: true };
  if (c.recipientPolicy === "NOBODY") return { ok: false, reason: "policy" };
  if (c.recipientPolicy === "FOLLOWING" && !c.recipientFollowsSender) return { ok: false, reason: "policy" };
  return { ok: true };
}

export const DM_DENIED_MESSAGE: Record<DmDenied, string> = {
  self: "You can't message yourself",
  banned: "Your account can't send messages",
  not_found: "That person isn't available",
  unreachable: "This person can't receive messages",
  blocked: "You can't message this person",
  policy: "This person only accepts messages from people they follow",
};
