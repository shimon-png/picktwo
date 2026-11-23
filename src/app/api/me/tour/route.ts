import { and, eq, isNull } from "drizzle-orm";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/** Marks the Vote tutorial as seen for this account, so it only auto-shows on the first login ever. Idempotent. */
export const POST = handler(async () => {
  const user = await requireUser();
  await db.update(users).set({ tourSeenAt: new Date() }).where(and(eq(users.id, user.id), isNull(users.tourSeenAt)));
  return { ok: true };
});
