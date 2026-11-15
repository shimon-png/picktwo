import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { boostBattle } from "@/server/services/battles";

export const POST = handler<{ slug: string }>(async (_req, { params }) => {
  const { slug } = await params;
  return boostBattle(slug, await requireUser());
});
