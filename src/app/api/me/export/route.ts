import { eq, inArray } from "drizzle-orm";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { db } from "@/server/db";
import { battles, options, votes, outcomes, pointLedger, follows, consentEvents, directMessages, pickbotThreads, pickbotMessages } from "@/server/db/schema";

export const GET = handler(async () => {
  const user = await requireUser();
  const myBattles = await db.select().from(battles).where(eq(battles.authorId, user.id));
  const ids = myBattles.map((b) => b.id);
  const threads = await db.select().from(pickbotThreads).where(eq(pickbotThreads.userId, user.id));
  const [opts, myVotes, myOutcomes, ledger, following, consent, sentMessages, pickbotMsgs] = await Promise.all([
    ids.length ? db.select().from(options).where(inArray(options.battleId, ids)) : [],
    db.select().from(votes).where(eq(votes.userId, user.id)),
    db.select().from(outcomes).where(eq(outcomes.userId, user.id)),
    db.select().from(pointLedger).where(eq(pointLedger.userId, user.id)),
    db.select().from(follows).where(eq(follows.followerId, user.id)),
    db.select().from(consentEvents).where(eq(consentEvents.userId, user.id)),
    // Messages you wrote (other people's messages to you belong to them).
    db.select({ id: directMessages.id, conversationId: directMessages.conversationId, body: directMessages.body, createdAt: directMessages.createdAt }).from(directMessages).where(eq(directMessages.senderId, user.id)),
    threads.length
      ? db
          .select({ threadId: pickbotMessages.threadId, role: pickbotMessages.role, kind: pickbotMessages.kind, text: pickbotMessages.text, photos: pickbotMessages.photos, answer: pickbotMessages.answer, rating: pickbotMessages.rating, createdAt: pickbotMessages.createdAt })
          .from(pickbotMessages)
          .where(inArray(pickbotMessages.threadId, threads.map((t) => t.id)))
      : [],
  ]);
  const data = { exportedAt: new Date(), profile: user, battles: myBattles, options: opts, votes: myVotes, outcomes: myOutcomes, ledger, following, consent, sentMessages, pickbot: { threads, messages: pickbotMsgs } };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="crowdpick-export.json"` },
  });
});
