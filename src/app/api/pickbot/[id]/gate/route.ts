import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { answerGate } from "@/server/services/pickbot";
import { gateInput } from "@/lib/pickbot-input";

/** A profile question inside Pickbot (answer null = "skip, just answer"). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await getCurrentUser();
  await rateLimit("generic", `pickbot:${user?.id ?? "anon"}`);
  return answerGate(user, (await params).id, gateInput.parse(await req.json()));
});
