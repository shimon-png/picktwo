import { handler } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { skipBattle } from "@/server/services/votes";

export const POST = handler<{ slug: string }>(async (_req, { params }) => {
  const { slug } = await params;
  await skipBattle(slug, await getViewer());
  return { ok: true };
});
