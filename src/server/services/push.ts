/**
 * Web push (PRD phase 4): a notification on the phone when a Pickbot crowd battle's results are in (more kinds can
 * use `sendPush`). Needs VAPID keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (+ VAPID_SUBJECT, a mailto: or
 * https: contact). Without them it's off. On iPhone, push works once crowdpick is added to the home screen.
 */
import { sendNotification, setVapidDetails } from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { pushSubscriptions } from "../db/schema";
import { track } from "../analytics";

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function init() {
  if (ready) return;
  setVapidDetails(process.env.VAPID_SUBJECT || "https://crowdpick.ai/contact", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

export async function savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  track("push_subscribed", {}, { userId });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/** Sends to every browser the person allowed. Never throws; gone subscriptions (404/410) are removed. */
export async function sendPush(userId: string, msg: { title: string; body: string; url: string; tag?: string }) {
  if (!pushConfigured()) return 0;
  try {
    init();
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    let sent = 0;
    for (const s of subs) {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        else console.error("[push]", code, (e as Error).message);
      }
    }
    if (sent) track("push_sent", { tag: msg.tag ?? null, devices: sent }, { userId });
    return sent;
  } catch (e) {
    console.error("[push]", e);
    return 0;
  }
}
