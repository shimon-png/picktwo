import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { postCrowd } from "@/server/services/pickbot";
import { postCrowdInput } from "@/lib/pickbot-input";

/** Post the reviewed draft as an anonymous "Asked via Pickbot" battle. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await getCurrentUser();
  await rateLimit("createBattleHour", user?.id ?? "anon");
  return postCrowd(user, (await params).id, postCrowdInput.parse(await req.json()));
});
