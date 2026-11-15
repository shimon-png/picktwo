import { handler } from "@/server/api";
import { getViewer, isAdmin } from "@/server/viewer";
import { getFeed } from "@/server/services/feed";
import { CATEGORY_IDS } from "@/lib/constants";

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const cat = url.searchParams.get("category") || undefined;
  const viewer = await getViewer();
  const items = await getFeed(viewer, {
    category: cat && (CATEGORY_IDS as readonly string[]).includes(cat) ? cat : undefined,
    limit: 20,
    debug: url.searchParams.get("debug") === "1" && isAdmin(viewer.user),
  });
  return { items };
});
