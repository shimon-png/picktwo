import { after } from "next/server";
import { handler } from "@/server/api";
import { emailBattleLive } from "@/server/services/lifecycle";
import { isAdmin, requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { createBattleInput } from "@/lib/validators";
import { createBattle } from "@/server/services/battles";
import { AppError } from "@/server/errors";
import { profileIncomplete } from "@/lib/profile";

export const POST = handler(async (req) => {
  const user = await requireUser();
  if (profileIncomplete(user)) throw new AppError("FORBIDDEN", "Finish your profile (ZIP, sex and age) before posting");
  await rateLimit("createBattleHour", user.id);
  await rateLimit("createBattleDay", user.id);
  const input = createBattleInput.parse(await req.json());
  const res = await createBattle(user, input, { asAdmin: isAdmin(user) });
  after(() => emailBattleLive(res.slug));
  return res;
});
