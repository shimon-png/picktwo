import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { threadOutcome } from "@/server/services/pickbot";
import { outcomeInput } from "@/lib/pickbot-input";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await getCurrentUser();
  await rateLimit("generic", `pickbot:${user?.id ?? "anon"}`);
  return threadOutcome(user, (await params).id, outcomeInput.parse(await req.json()).chosen);
});
