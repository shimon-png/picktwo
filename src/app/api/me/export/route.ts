import { eq, inArray } from "drizzle-orm";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { db } from "@/server/db";
import { battles, options, votes, outcomes, pointLedger, follows, consentEvents } from "@/server/db/schema";

export const GET = handler(async () => {
  const user = await requireUser();
  const myBattles = await db.select().from(battles).where(eq(battles.authorId, user.id));
  const ids = myBattles.map((b) => b.id);
  const [opts, myVotes, myOutcomes, ledger, following, consent] = await Promise.all([
    ids.length ? db.select().from(options).where(inArray(options.battleId, ids)) : [],
    db.select().from(votes).where(eq(votes.userId, user.id)),
    db.select().from(outcomes).where(eq(outcomes.userId, user.id)),
    db.select().from(pointLedger).where(eq(pointLedger.userId, user.id)),
    db.select().from(follows).where(eq(follows.followerId, user.id)),
    db.select().from(consentEvents).where(eq(consentEvents.userId, user.id)),
  ]);
  const data = { exportedAt: new Date(), profile: user, battles: myBattles, options: opts, votes: myVotes, outcomes: myOutcomes, ledger, following, consent };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="crowdpick-export.json"` },
  });
});
