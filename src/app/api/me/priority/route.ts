import { desc, eq } from "drizzle-orm";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { db } from "@/server/db";
import { pointLedger } from "@/server/db/schema";
import { getEconomy } from "@/server/services/config";
import { awaitingOutcome, countOpenLoops } from "@/server/services/points";
import { priorityTier } from "@/server/services/priority";

export const GET = handler(async () => {
  const user = await requireUser();
  const economy = await getEconomy();
  const [ledger, openLoops, awaiting] = await Promise.all([
    db.select().from(pointLedger).where(eq(pointLedger.userId, user.id)).orderBy(desc(pointLedger.createdAt)).limit(50),
    countOpenLoops(user.id, economy),
    awaitingOutcome(user.id),
  ]);
  return { ppBalance: user.ppBalance, openLoops, awaiting, ledger, tier: priorityTier(user.ppBalance, openLoops, economy.priorityCap) };
});
