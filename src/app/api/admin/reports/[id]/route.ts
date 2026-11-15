import { eq } from "drizzle-orm";
import { z } from "zod";
import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { db } from "@/server/db";
import { reports, battles, votes, users } from "@/server/db/schema";
import { AppError } from "@/server/errors";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { action } = z.object({ action: z.enum(["hide", "delete", "restore", "ban", "dismiss"]) }).parse(await req.json());
  const [r] = await db.select().from(reports).where(eq(reports.id, id));
  if (!r) throw new AppError("NOT_FOUND", "Report not found");
  if (r.targetType === "BATTLE") {
    if (action === "hide") await db.update(battles).set({ status: "HIDDEN" }).where(eq(battles.id, r.targetId));
    if (action === "delete") await db.update(battles).set({ status: "DELETED" }).where(eq(battles.id, r.targetId));
    if (action === "restore") await db.update(battles).set({ status: "OPEN" }).where(eq(battles.id, r.targetId));
    if (action === "ban") {
      const [b] = await db.select({ a: battles.authorId }).from(battles).where(eq(battles.id, r.targetId));
      if (b) await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, b.a));
      await db.update(battles).set({ status: "HIDDEN" }).where(eq(battles.id, r.targetId));
    }
  }
  if (r.targetType === "REASON") {
    if (action === "hide" || action === "delete") await db.update(votes).set({ reasonHidden: true }).where(eq(votes.id, r.targetId));
    if (action === "restore") await db.update(votes).set({ reasonHidden: false }).where(eq(votes.id, r.targetId));
    if (action === "ban") {
      const [v] = await db.select({ u: votes.userId }).from(votes).where(eq(votes.id, r.targetId));
      if (v?.u) await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, v.u));
      await db.update(votes).set({ reasonHidden: true }).where(eq(votes.id, r.targetId));
    }
  }
  if (r.targetType === "USER" && action === "ban") await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, r.targetId));
  await db
    .update(reports)
    .set({ status: action === "dismiss" || action === "restore" ? "DISMISSED" : "ACTIONED", resolvedBy: admin.id, resolvedAt: new Date() })
    .where(eq(reports.id, id));
  return { ok: true };
});
