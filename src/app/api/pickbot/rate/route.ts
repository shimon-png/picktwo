import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { rateAnswer } from "@/server/services/pickbot";
import { rateInput } from "@/lib/pickbot-input";

export const POST = handler(async (req) => {
  const user = await getCurrentUser();
  await rateLimit("generic", `pickbot:${user?.id ?? "anon"}`);
  const i = rateInput.parse(await req.json());
  return rateAnswer(user, i.messageId, i.rating, i.note);
});
