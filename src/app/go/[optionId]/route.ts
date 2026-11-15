import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { options } from "@/server/db/schema";
import { track } from "@/server/analytics";
import { getViewer } from "@/server/viewer";

/** Logs a click on an option link, then redirects (affiliate params can be appended here later). */
export async function GET(_req: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const { optionId } = await params;
  const [o] = await db
    .update(options)
    .set({ clicks: sql`${options.clicks} + 1` })
    .where(eq(options.id, optionId))
    .returning({ url: options.url, battleId: options.battleId });
  if (!o?.url) return new Response("Not found", { status: 404 });
  const v = await getViewer();
  track("option_link_clicked", { optionId, battleId: o.battleId }, { userId: v.user?.id, deviceId: v.deviceId });
  return Response.redirect(o.url, 302);
}
