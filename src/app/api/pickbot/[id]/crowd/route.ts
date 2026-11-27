import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { setCrowd } from "@/server/services/pickbot";
import { crowdInput } from "@/lib/pickbot-input";

/** The "Get answers from the crowd" box: on posts the question anonymously, off takes it down (private). */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await getCurrentUser();
  await rateLimit("pickbotAnswer", user?.id ?? "anon");
  return setCrowd(user, (await params).id, crowdInput.parse(await req.json()).on);
});
