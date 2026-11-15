import { and, eq } from "drizzle-orm";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { db } from "@/server/db";
import { blocks, follows } from "@/server/db/schema";

export const POST = handler<{ userId: string }>(async (_req, { params }) => {
  const { userId } = await params;
  const me = await requireUser();
  await db.insert(blocks).values({ blockerId: me.id, blockedId: userId }).onConflictDoNothing();
  await db.delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, userId)));
  await db.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.followingId, me.id)));
  return { blocked: true };
});

export const DELETE = handler<{ userId: string }>(async (_req, { params }) => {
  const { userId } = await params;
  const me = await requireUser();
  await db.delete(blocks).where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, userId)));
  return { blocked: false };
});
