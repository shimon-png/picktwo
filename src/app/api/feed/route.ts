import { handler } from "@/server/api";
import { getViewer, isAdmin } from "@/server/viewer";
import { getFeed } from "@/server/services/feed";

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const viewer = await getViewer();
  const items = await getFeed(viewer, {
    limit: 20,
    debug: url.searchParams.get("debug") === "1" && isAdmin(viewer.user),
  });
  return { items };
});
