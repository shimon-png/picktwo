import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { repostBattle } from "@/server/services/battles";

export const POST = handler<{ slug: string }>(async (_req, { params }) => {
  const { slug } = await params;
  const user = await requireUser();
  await rateLimit("createBattleHour", user.id);
  await rateLimit("createBattleDay", user.id);
  return repostBattle(slug, user);
});
