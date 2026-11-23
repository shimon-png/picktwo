import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { notifications } from "../db/schema";

export type NotificationType =
  | "VOTES_MILESTONE"
  | "BATTLE_CLOSED"
  | "REMINDER"
  | "OUTCOME"
  | "CALLED_IT"
  | "HELPFUL"
  | "FOLLOW"
  | "POINTS"
  | "DM_REQUEST"
  | "DM_ACCEPTED";

export async function notify(tx: DbOrTx, userId: string, type: NotificationType, payload: Record<string, unknown>) {
  await tx.insert(notifications).values({ userId, type, payload });
}

export async function listNotifications(userId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
