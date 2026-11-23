import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { messageInput } from "@/lib/validators";
import { sendMessage } from "@/server/services/messages";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit("messageMinute", user.id);
  await rateLimit("messageDay", user.id);
  const input = messageInput.parse(await req.json());
  return sendMessage(user, input.to, input.body);
});
