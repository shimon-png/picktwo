import { and, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { blocks, conversations, directMessages, follows, users, type User } from "../db/schema";
import { AppError } from "../errors";
import { assertCleanText } from "../moderation";
import { track } from "../analytics";
import { notify } from "./notifications";
import { DM_MAX_LENGTH, canType, dmState, pairKey, sendDeniedMessage, type DmState } from "./dm-rules";

/** Rules and the user-facing flow are documented in `dm-rules.ts`. */

export type ThreadPerson = { id: string; handle: string; name: string | null; image: string | null };
export type DmView = { id: string; mine: boolean; body: string; createdAt: string };

async function findUserByHandle(handle: string) {
  const [u] = await db.select().from(users).where(eq(users.handle, handle.replace(/^@/, "").toLowerCase()));
  return u ?? null;
}

async function conversationFor(a: string, b: string) {
  const [x, y] = pairKey(a, b);
  const [c] = await db.select().from(conversations).where(and(eq(conversations.userA, x), eq(conversations.userB, y)));
  return c ?? null;
}

async function isBlockedEitherWay(a: string, b: string) {
  const [row] = await db
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))));
  return !!row;
}

/** The viewer's state with `other` (see `dmState`), plus the conversation row if there is one. */
async function resolve(me: User, other: User | null) {
  if (!other || !other.handle) return { state: { kind: "unavailable", reason: "not_found" } as DmState, convo: null };
  const [convo, blocked, [follow]] = await Promise.all([
    conversationFor(me.id, other.id),
    isBlockedEitherWay(me.id, other.id),
    db.select({ x: follows.followerId }).from(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, other.id))),
  ]);
  const state = dmState({
    self: me.id === other.id,
    meBanned: !!me.bannedAt,
    otherBanned: !!other.bannedAt,
    otherReachable: !!other.email,
    blocked,
    meChatOn: me.chatEnabled,
    otherChatOn: other.chatEnabled,
    iFollow: !!follow,
    convo: convo ? { status: convo.status, requestedByMe: convo.requestedBy === me.id } : null,
  });
  return { state, convo };
}

/** Whether the viewer may see "Send DM" for this person (they follow them and it isn't blocked/unavailable). */
export async function dmEntryState(me: User, other: User) {
  return (await resolve(me, other)).state;
}

export async function sendMessage(me: User, toHandle: string, rawBody: string): Promise<{ message: DmView; requested: boolean }> {
  const body = rawBody.trim();
  if (!body) throw new AppError("VALIDATION", "Write a message first");
  if (body.length > DM_MAX_LENGTH) throw new AppError("VALIDATION", `Messages can be up to ${DM_MAX_LENGTH} characters`);
  assertCleanText(body);
  const other = await findUserByHandle(toHandle);
  const { state } = await resolve(me, other);
  if (!canType(state)) throw new AppError(state.kind === "unavailable" && state.reason === "not_found" ? "NOT_FOUND" : "FORBIDDEN", sendDeniedMessage(state, other?.handle ?? toHandle));
  const [a, b] = pairKey(me.id, other!.id);
  const now = new Date();
  const requested = state.kind === "can_request";
  const msg = await db.transaction(async (tx) => {
    let convoId: string;
    if (requested) {
      const [c] = await tx
        .insert(conversations)
        .values({ userA: a, userB: b, status: "PENDING", requestedBy: me.id, lastMessageAt: now })
        .onConflictDoNothing({ target: [conversations.userA, conversations.userB] })
        .returning({ id: conversations.id });
      if (!c) throw new AppError("CONFLICT", "You already have a conversation with this person. Refresh and try again.");
      convoId = c.id;
      await notify(tx, other!.id, "DM_REQUEST", { handle: me.handle, name: me.name });
    } else {
      const [c] = await tx
        .update(conversations)
        .set({ lastMessageAt: now })
        .where(and(eq(conversations.userA, a), eq(conversations.userB, b)))
        .returning({ id: conversations.id });
      convoId = c.id;
    }
    const [m] = await tx.insert(directMessages).values({ conversationId: convoId, senderId: me.id, body, createdAt: now }).returning();
    return m;
  });
  track(requested ? "dm_requested" : "dm_sent", { length: body.length }, { userId: me.id });
  return { message: { id: msg.id, mine: true, body: msg.body, createdAt: msg.createdAt.toISOString() }, requested };
}

/** Accept or decline a message request from `fromHandle`. Needs your messages turned on. */
export async function respondToRequest(me: User, fromHandle: string, accept: boolean) {
  const other = await findUserByHandle(fromHandle);
  const { state, convo } = await resolve(me, other);
  if (state.kind === "enable_chat") throw new AppError("FORBIDDEN", "Turn on messages in Settings first");
  if ((state.kind !== "request_received" && state.kind !== "declined") || !convo) throw new AppError("CONFLICT", "There's no message request to answer");
  await db.transaction(async (tx) => {
    await tx.update(conversations).set({ status: accept ? "ACCEPTED" : "DECLINED" }).where(eq(conversations.id, convo.id));
    if (accept) await notify(tx, other!.id, "DM_ACCEPTED", { handle: me.handle, name: me.name });
  });
  track(accept ? "dm_request_accepted" : "dm_request_declined", {}, { userId: me.id });
  return { status: accept ? "ACCEPTED" : "DECLINED" };
}

export type InboxRow = {
  id: string;
  other: ThreadPerson;
  /** chat = accepted; request = they want to message you; sent = your request is waiting. */
  kind: "chat" | "request" | "sent";
  last: { body: string; mine: boolean; createdAt: string } | null;
  unread: number;
};

/** Your chats and message requests, newest first. Blocked people, declined requests and banned users are left out. */
export async function listInbox(user: User, limit = 100): Promise<InboxRow[]> {
  const rows = await db.execute<{
    id: string;
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    requested_by: string | null;
    other_id: string;
    handle: string | null;
    name: string | null;
    image: string | null;
    last_body: string | null;
    last_sender: string | null;
    last_at: string | null;
    unread: number;
  }>(sql`
    SELECT c.id, c.status, c.requested_by, u.id AS other_id, u.handle, u.name, u.image,
      lm.body AS last_body, lm.sender_id AS last_sender, lm.created_at AS last_at,
      (SELECT count(*)::int FROM direct_message m WHERE m.conversation_id = c.id AND m.sender_id <> ${user.id} AND m.read_at IS NULL) AS unread
    FROM conversation c
    JOIN "user" u ON u.id = CASE WHEN c.user_a = ${user.id} THEN c.user_b ELSE c.user_a END
    LEFT JOIN LATERAL (SELECT body, sender_id, created_at FROM direct_message m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) lm ON true
    WHERE (c.user_a = ${user.id} OR c.user_b = ${user.id})
      AND u.banned_at IS NULL AND u.handle IS NOT NULL
      AND NOT (c.status = 'DECLINED' AND c.requested_by <> ${user.id})
      AND NOT EXISTS (SELECT 1 FROM block bl WHERE bl.blocker_id = ${user.id} AND bl.blocked_id = u.id)
    ORDER BY c.last_message_at DESC
    LIMIT ${limit}`);
  return rows.map((r) => {
    const kind: InboxRow["kind"] = r.status === "ACCEPTED" ? "chat" : r.requested_by === user.id ? "sent" : "request";
    return {
      id: r.id,
      other: { id: r.other_id, handle: r.handle!, name: r.name, image: r.image },
      kind,
      // A request's text stays hidden from the receiver until they accept.
      last: r.last_body && kind !== "request" ? { body: r.last_body, mine: r.last_sender === user.id, createdAt: new Date(r.last_at!).toISOString() } : null,
      unread: kind === "chat" ? r.unread : 0,
    };
  });
}

/** Header badge: unread messages in your chats + message requests waiting for you. Blocked senders don't count. */
export async function unreadMessageCount(userId: string): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM direct_message m JOIN conversation c ON c.id = m.conversation_id
        WHERE c.status = 'ACCEPTED' AND (c.user_a = ${userId} OR c.user_b = ${userId}) AND m.sender_id <> ${userId} AND m.read_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM block bl WHERE bl.blocker_id = ${userId} AND bl.blocked_id = m.sender_id))
      + (SELECT count(*)::int FROM conversation c
        WHERE c.status = 'PENDING' AND c.requested_by <> ${userId} AND (c.user_a = ${userId} OR c.user_b = ${userId})
          AND NOT EXISTS (SELECT 1 FROM block bl WHERE bl.blocker_id = ${userId} AND bl.blocked_id = c.requested_by)) AS n`);
  return r?.n ?? 0;
}

export type Thread = {
  other: ThreadPerson;
  state: DmState;
  /** Messages you're allowed to see (a request's text is hidden from the receiver until accepted). */
  messages: DmView[];
  iBlocked: boolean;
};

/** One conversation with `otherHandle`. Marks visible messages from them as read. */
export async function getThread(user: User, otherHandle: string, opts: { after?: string; limit?: number } = {}): Promise<Thread> {
  const other = await findUserByHandle(otherHandle);
  if (!other || !other.handle || other.bannedAt || other.id === user.id) throw new AppError("NOT_FOUND", "Conversation not found");
  const [{ state, convo }, [iBlockedRow]] = await Promise.all([
    resolve(user, other),
    db.select({ x: blocks.blockerId }).from(blocks).where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, other.id))),
  ]);
  const visible = !!convo && (convo.status === "ACCEPTED" || convo.requestedBy === user.id);
  let messages: DmView[] = [];
  if (convo && visible) {
    const after = opts.after ? new Date(opts.after) : null;
    const rows = await db
      .select()
      .from(directMessages)
      .where(and(eq(directMessages.conversationId, convo.id), after && !isNaN(after.getTime()) ? gt(directMessages.createdAt, after) : sql`true`))
      .orderBy(desc(directMessages.createdAt))
      .limit(opts.limit ?? 200);
    messages = rows.reverse().map((m) => ({ id: m.id, mine: m.senderId === user.id, body: m.body, createdAt: m.createdAt.toISOString() }));
    await db
      .update(directMessages)
      .set({ readAt: new Date() })
      .where(and(eq(directMessages.conversationId, convo.id), ne(directMessages.senderId, user.id), isNull(directMessages.readAt)));
  }
  return { other: { id: other.id, handle: other.handle, name: other.name, image: other.image }, state, messages, iBlocked: !!iBlockedRow };
}

/** Text of a message the user received in an accepted chat, for attaching to a report. */
export async function receivedMessageText(user: User, messageId: string) {
  const [m] = await db
    .select({ body: directMessages.body, senderId: directMessages.senderId, a: conversations.userA, b: conversations.userB })
    .from(directMessages)
    .innerJoin(conversations, eq(conversations.id, directMessages.conversationId))
    .where(eq(directMessages.id, messageId));
  if (!m || m.senderId === user.id || (m.a !== user.id && m.b !== user.id)) return null;
  return { body: m.body, senderId: m.senderId };
}
