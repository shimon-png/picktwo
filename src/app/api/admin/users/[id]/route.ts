import { eq } from "drizzle-orm";
import { z } from "zod";
import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { awardPoints } from "@/server/services/points";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const body = z.object({ action: z.enum(["ban", "unban", "points", "makeAdmin"]), delta: z.number().int().optional() }).parse(await req.json());
  if (body.action === "ban") await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, id));
  if (body.action === "unban") await db.update(users).set({ bannedAt: null }).where(eq(users.id, id));
  if (body.action === "makeAdmin") await db.update(users).set({ role: "ADMIN" }).where(eq(users.id, id));
  if (body.action === "points" && body.delta) await awardPoints(db, id, body.delta, "ADMIN_ADJUST");
  return { ok: true };
});
