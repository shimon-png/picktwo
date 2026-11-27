import { z } from "zod";
import { handler } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { answerMind } from "@/server/services/mind";
import { getFeed } from "@/server/services/feed";
import { MIND_TOPIC_IDS } from "@/lib/mind";

/** null = skipped */
const input = z.object({ topic: z.enum(MIND_TOPIC_IDS).nullable(), text: z.string().max(200).optional() });

/**
 * Answer (or skip) "What's on your mind this week?". Returns the next battles, already steered toward the topic,
 * so the deck can put them up next.
 */
export const POST = handler(async (req) => {
  const viewer = await getViewer();
  await rateLimit("generic", `mind:${viewer.user?.id ?? viewer.deviceId ?? "anon"}`);
  const { topic, text } = input.parse(await req.json());
  await answerMind(viewer, topic, text);
  return { items: topic ? await getFeed(viewer, { limit: 20 }) : [] };
});
