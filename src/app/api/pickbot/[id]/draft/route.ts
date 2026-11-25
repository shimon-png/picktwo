import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { draftCrowd } from "@/server/services/pickbot";

/** Draft an anonymous crowd battle for review (nothing is posted). */
export const POST = handler<{ id: string }>(async (_req, { params }) => {
  const user = await getCurrentUser();
  await rateLimit("pickbotAnswer", user?.id ?? "anon");
  return draftCrowd(user, (await params).id);
});
