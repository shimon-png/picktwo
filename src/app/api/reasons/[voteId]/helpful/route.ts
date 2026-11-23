import { after } from "next/server";
import { handler } from "@/server/api";
import { queueHelpfulEmail } from "@/server/services/lifecycle";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { toggleHelpful } from "@/server/services/votes";

export const POST = handler<{ voteId: string }>(async (_req, { params }) => {
  const { voteId } = await params;
  const user = await requireUser();
  await rateLimit("reason", user.id);
  const res = await toggleHelpful(voteId, user);
  if (res.marked) after(() => queueHelpfulEmail(voteId));
  return res;
});
