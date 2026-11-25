import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { chooseStep } from "@/server/services/pickbot";
import { stepInput } from "@/lib/pickbot-input";

/** General vs tailored, or stop the quick battles. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await getCurrentUser();
  await rateLimit("generic", `pickbot:${user?.id ?? "anon"}`);
  return chooseStep(user, (await params).id, stepInput.parse(await req.json()).action);
});
