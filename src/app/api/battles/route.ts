import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { createBattleInput } from "@/lib/validators";
import { createBattle } from "@/server/services/battles";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit("createBattleHour", user.id);
  await rateLimit("createBattleDay", user.id);
  const input = createBattleInput.parse(await req.json());
  return createBattle(user, input);
});
