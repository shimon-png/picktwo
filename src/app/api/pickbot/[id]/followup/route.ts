import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { followUp } from "@/server/services/pickbot";
import { askInput } from "@/lib/pickbot-input";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await getCurrentUser();
  await rateLimit("pickbotAsk", user?.id ?? "anon");
  return followUp(user, (await params).id, askInput.parse(await req.json()));
});
