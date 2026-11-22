import { and, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { blocks, conversations, directMessages, follows, users, type User } from "../db/schema";
import { AppError } from "../errors";
import { assertCleanText } from "../moderation";
import { track } from "../analytics";
import { canSendDm, DM_DENIED_MESSAGE, DM_MAX_LENGTH, pairKey, type DmPolicy } from "./dm-rules";

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

/** Whether `sender` can message `recipient` right now (blocks, bans, the recipient's "who can message me" setting). */
export async function dmPermission(sender: User, recipient: User | null) {
  if (!recipient) return canSendDm({ ...EMPTY, self: false, recipientExists: false });
  const convo = await conversationFor(sender.id, recipient.id);
  const [blocked, [follow], [wrote]] = await Promise.all([
    isBlockedEitherWay(sender.id, recipient.id),
    db.select({ x: follows.followerId }).from(follows).where(and(eq(follows.followerId, recipient.id), eq(follows.followingId, sender.id))),
    convo
      ? db.select({ id: directMessages.id }).from(directMessages).where(and(eq(directMessages.conversationId, convo.id), eq(directMessages.senderId, recipient.id))).limit(1)
      : Promise.resolve([]),
  ]);
  return canSendDm({
    self: sender.id === recipient.id,
    senderBanned: !!sender.bannedAt,
    recipientExists: true,
    recipientBanned: !!recipient.bannedAt,
    recipientReachable: !!recipient.email && !!recipient.handle,
    blocked,
    recipientPolicy: (recipient.dmPolicy ?? "EVERYONE") as DmPolicy,
    recipientFollowsSender: !!follow,
    recipientWroteFirst: !!wrote,
  });
}
const EMPTY = {
  senderBanned: false,
  recipientBanned: false,
  recipientReachable: false,
  blocked: false,
  recipientPolicy: "EVERYONE" as DmPolicy,
  recipientFollowsSender: false,
  recipientWroteFirst: false,
};

export async function sendMessage(sender: User, toHandle: string, rawBody: string): Promise<DmView> {
  const body = rawBody.trim();
  if (!body) throw new AppError("VALIDATION", "Write a message first");
  if (body.length > DM_MAX_LENGTH) throw new AppError("VALIDATION", `Messages can be up to ${DM_MAX_LENGTH} characters`);
  assertCleanText(body);
  const recipient = await findUserByHandle(toHandle);
  const ok = await dmPermission(sender, recipient);
  if (!ok.ok) throw new AppError(ok.reason === "not_found" ? "NOT_FOUND" : "FORBIDDEN", DM_DENIED_MESSAGE[ok.reason]);
  const [a, b] = pairKey(sender.id, recipient!.id);
  const now = new Date();
  const msg = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(conversations)
      .values({ userA: a, userB: b, lastMessageAt: now })
      .onConflictDoUpdate({ target: [conversations.userA, conversations.userB], set: { lastMessageAt: now } })
      .returning({ id: conversations.id });
    const [m] = await tx.insert(directMessages).values({ conversationId: c.id, senderId: sender.id, body, createdAt: now }).returning();
    return m;
  });
  track("dm_sent", { length: body.length }, { userId: sender.id });
  return { id: msg.id, mine: true, body: msg.body, createdAt: msg.createdAt.toISOString() };
}

export type ConversationRow = {
  id: string;
  other: ThreadPerson;
  last: { body: string; mine: boolean; createdAt: string } | null;
  unread: number;
};

/** The user's conversations, newest first. Conversations with people they've blocked are left out. */
export async function listConversations(user: User, limit = 100): Promise<ConversationRow[]> {
  const rows = await db.execute<{
    id: string;
    other_id: string;
    handle: string | null;
    name: string | null;
    image: string | null;
    last_body: string | null;
    last_sender: string | null;
    last_at: string | null;
    unread: number;
  }>(sql`
    SELECT c.id, u.id AS other_id, u.handle, u.name, u.image,
      lm.body AS last_body, lm.sender_id AS last_sender, lm.created_at AS last_at,
      (SELECT count(*)::int FROM direct_message m WHERE m.conversation_id = c.id AND m.sender_id <> ${user.id} AND m.read_at IS NULL) AS unread
    FROM conversation c
    JOIN "user" u ON u.id = CASE WHEN c.user_a = ${user.id} THEN c.user_b ELSE c.user_a END
    LEFT JOIN LATERAL (SELECT body, sender_id, created_at FROM direct_message m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) lm ON true
    WHERE (c.user_a = ${user.id} OR c.user_b = ${user.id})
      AND u.banned_at IS NULL AND u.handle IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM block bl WHERE bl.blocker_id = ${user.id} AND bl.blocked_id = u.id)
    ORDER BY c.last_message_at DESC
    LIMIT ${limit}`);
  return rows.map((r) => ({
    id: r.id,
    other: { id: r.other_id, handle: r.handle!, name: r.name, image: r.image },
    last: r.last_body ? { body: r.last_body, mine: r.last_sender === user.id, createdAt: new Date(r.last_at!).toISOString() } : null,
    unread: r.unread,
  }));
}

/** Unread messages across all conversations (for the header badge). Messages from people you blocked don't count. */
export async function unreadMessageCount(userId: string): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM direct_message m
    JOIN conversation c ON c.id = m.conversation_id
    WHERE (c.user_a = ${userId} OR c.user_b = ${userId}) AND m.sender_id <> ${userId} AND m.read_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM block bl WHERE bl.blocker_id = ${userId} AND bl.blocked_id = m.sender_id)`);
  return r?.n ?? 0;
}

export type Thread = {
  other: ThreadPerson;
  messages: DmView[];
  canSend: boolean;
  /** Why the composer is disabled (blocked, their setting, …). */
  notice: string | null;
  iBlocked: boolean;
};

/** One conversation with `otherHandle`: messages (oldest first, optionally only newer than `after`) and whether you can reply. Marks theirs read. */
export async function getThread(user: User, otherHandle: string, opts: { after?: string; limit?: number } = {}): Promise<Thread> {
  const other = await findUserByHandle(otherHandle);
  if (!other || !other.handle || other.bannedAt || other.id === user.id) throw new AppError("NOT_FOUND", "Conversation not found");
  const [convo, permission, [iBlockedRow]] = await Promise.all([
    conversationFor(user.id, other.id),
    dmPermission(user, other),
    db.select({ x: blocks.blockerId }).from(blocks).where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, other.id))),
  ]);
  let messages: DmView[] = [];
  if (convo) {
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
  return {
    other: { id: other.id, handle: other.handle, name: other.name, image: other.image },
    messages,
    canSend: permission.ok,
    notice: permission.ok ? null : !!iBlockedRow ? "You blocked this person. Unblock them to send a message." : DM_DENIED_MESSAGE[permission.reason],
    iBlocked: !!iBlockedRow,
  };
}

/** Text of a message the user received, for attaching to a report. */
export async function receivedMessageText(user: User, messageId: string) {
  const [m] = await db
    .select({ body: directMessages.body, senderId: directMessages.senderId, a: conversations.userA, b: conversations.userB })
    .from(directMessages)
    .innerJoin(conversations, eq(conversations.id, directMessages.conversationId))
    .where(eq(directMessages.id, messageId));
  if (!m || m.senderId === user.id || (m.a !== user.id && m.b !== user.id)) return null;
  return { body: m.body, senderId: m.senderId };
}

