import { and, eq } from "drizzle-orm";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { db } from "@/server/db";
import { follows, users } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { notify } from "@/server/services/notifications";
import { track } from "@/server/analytics";

export const POST = handler<{ userId: string }>(async (_req, { params }) => {
  const { userId } = await params;
  const me = await requireUser();
  await rateLimit("generic", me.id);
  if (userId === me.id) throw new AppError("VALIDATION", "You can't follow yourself");
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!target) throw new AppError("NOT_FOUND", "User not found");
  const ins = await db.insert(follows).values({ followerId: me.id, followingId: userId }).onConflictDoNothing().returning();
  if (ins.length) {
    await notify(db, userId, "FOLLOW", { handle: me.handle, name: me.name });
    track("follow", { userId }, { userId: me.id });
  }
  return { following: true };
});

export const DELETE = handler<{ userId: string }>(async (_req, { params }) => {
  const { userId } = await params;
  const me = await requireUser();
  await db.delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, userId)));
  return { following: false };
});
