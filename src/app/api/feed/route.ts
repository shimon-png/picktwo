import { handler } from "@/server/api";
import { getViewer, isAdmin } from "@/server/viewer";
import { getDeck } from "@/server/services/feed";
import { deckTopic } from "@/lib/topics";

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const viewer = await getViewer();
  const { items, counts } = await getDeck(viewer, {
    limit: 20,
    debug: url.searchParams.get("debug") === "1" && isAdmin(viewer.user),
    // Topics A/B test (lib/topics.ts): ?topic= narrows the deck; unknown values are Mix.
    topic: deckTopic(url.searchParams.get("topic")),
  });
  return { items, counts };
});
