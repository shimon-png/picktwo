import { z } from "zod";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { removePushSubscription, savePushSubscription } from "@/server/services/push";

const sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** Save this browser's push subscription for the signed-in person. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit("generic", `push:${user.id}`);
  await savePushSubscription(user.id, sub.parse(await req.json()));
  return { ok: true };
});

export const DELETE = handler(async (req) => {
  const user = await requireUser();
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(await req.json());
  await removePushSubscription(user.id, endpoint);
  return { ok: true };
});
