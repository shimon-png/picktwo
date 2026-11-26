import { handler } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { askingFor } from "@/server/services/asking";
import { ASKING_TOPICS, type AskingTopic } from "@/lib/asking";

/** "People like you are asking" questions for this viewer. `?topic=` = the "What's on your mind this week?" answer. */
export const GET = handler(async (req) => {
  const t = new URL(req.url).searchParams.get("topic");
  const topic = (ASKING_TOPICS as readonly string[]).includes(t ?? "") ? (t as AskingTopic) : null;
  return { card: await askingFor(await getViewer(), { topic }) };
});
