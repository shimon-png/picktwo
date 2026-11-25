import { eq, inArray, or } from "drizzle-orm";
import { del } from "@vercel/blob";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { db } from "@/server/db";
import { users, votes, battles, options, notifications, accounts, sessions, follows, devices, consentEvents, conversations, pickbotThreads, pushSubscriptions } from "@/server/db/schema";
import { cancelPlus } from "@/server/services/plus";
import { signOut } from "@/server/auth";
import { POLICY_VERSION } from "@/lib/constants";

/** Delete account (PRD 13.4): anonymise the user, keep votes as anonymous aggregates, soft-delete battles. */
export const DELETE = handler(async () => {
  const user = await requireUser();
  // Stop a Plus subscription first, so a deleted account is never billed again.
  await cancelPlus(user);
  const myBattles = await db.select({ id: battles.id }).from(battles).where(eq(battles.authorId, user.id));
  const ids = myBattles.map((b) => b.id);
  const blobUrls = ids.length
    ? (await db.select({ u: options.imageUrl }).from(options).where(inArray(options.battleId, ids)))
        .map((r) => r.u)
        .filter((u): u is string => !!u && u.includes("blob.vercel-storage.com"))
    : [];
  if (user.image?.includes(".blob.vercel-storage.com/avatars/")) blobUrls.push(user.image);
  await db.transaction(async (tx) => {
    await tx.update(votes).set({ userId: null, reason: null }).where(eq(votes.userId, user.id));
    if (ids.length) await tx.update(battles).set({ status: "DELETED" }).where(inArray(battles.id, ids));
    await tx.delete(notifications).where(eq(notifications.userId, user.id));
    await tx.delete(accounts).where(eq(accounts.userId, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(follows).where(eq(follows.followerId, user.id));
    await tx.delete(follows).where(eq(follows.followingId, user.id));
    // Direct messages go with the account (cascades to direct_message).
    await tx.delete(conversations).where(or(eq(conversations.userA, user.id), eq(conversations.userB, user.id)));
    // Pickbot questions and push addresses go with the account (anonymous crowd battles stay).
    await tx.delete(pickbotThreads).where(eq(pickbotThreads.userId, user.id));
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
    await tx.update(devices).set({ userId: null }).where(eq(devices.userId, user.id));
    await tx.insert(consentEvents).values({ userId: user.id, type: "account_deleted", value: true, version: POLICY_VERSION });
    await tx
      .update(users)
      .set({ email: null, name: null, handle: null, bio: null, image: null, city: null, kidAges: [], interests: [], dataConsent: false, bannedAt: new Date() })
      .where(eq(users.id, user.id));
  });
  if (blobUrls.length && process.env.BLOB_READ_WRITE_TOKEN) await del(blobUrls).catch(() => {});
  await signOut({ redirect: false }).catch(() => {});
  return { ok: true };
});
