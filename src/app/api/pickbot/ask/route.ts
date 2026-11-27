import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { askPickbot } from "@/server/services/pickbot";
import { askInput } from "@/lib/pickbot-input";

/** A new Pickbot question → { id } of the thread. */
export const POST = handler(async (req) => {
  const user = await getCurrentUser();
  await rateLimit("pickbotAsk", user?.id ?? "anon");
  return askPickbot(user, askInput.parse(await req.json()));
});
