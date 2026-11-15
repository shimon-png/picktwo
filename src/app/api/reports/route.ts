import { and, eq, sql } from "drizzle-orm";
import { handler } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { reportInput } from "@/lib/validators";
import { db } from "@/server/db";
import { reports, battles, votes } from "@/server/db/schema";
import { getConfig } from "@/server/services/config";
import { track } from "@/server/analytics";

export const POST = handler(async (req) => {
  const viewer = await getViewer();
  await rateLimit("report", viewer.user?.id ?? viewer.deviceId ?? "anon");
  const input = reportInput.parse(await req.json());
  await db.insert(reports).values({ ...input, reporterId: viewer.user?.id ?? null });
  if (input.targetType === "BATTLE") {
    const [b] = await db
      .update(battles)
      .set({ reportCount: sql`${battles.reportCount} + 1` })
      .where(eq(battles.id, input.targetId))
      .returning({ id: battles.id });
    // Child-safety reports auto-hide pending review (PRD 13.1)
    if (b && input.reason === "minor_safety") {
      const { features } = await getConfig();
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(reports)
        .where(and(eq(reports.targetId, b.id), eq(reports.reason, "minor_safety"), eq(reports.status, "OPEN")));
      if (n >= features.childSafetyAutoHideReports) await db.update(battles).set({ status: "HIDDEN" }).where(eq(battles.id, b.id));
    }
  }
  if (input.targetType === "REASON" && input.reason === "minor_safety")
    await db.update(votes).set({ reasonHidden: true }).where(eq(votes.id, input.targetId));
  track("report_submitted", { targetType: input.targetType, reason: input.reason }, { userId: viewer.user?.id, deviceId: viewer.deviceId });
  return { ok: true };
});
