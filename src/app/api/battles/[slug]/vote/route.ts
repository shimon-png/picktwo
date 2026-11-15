import { handler, clientIp } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { voteInput } from "@/lib/validators";
import { castVote } from "@/server/services/votes";

export const POST = handler<{ slug: string }>(async (req, { params }) => {
  const { slug } = await params;
  const viewer = await getViewer();
  await rateLimit("vote", viewer.user?.id ?? viewer.deviceId ?? "anon");
  await rateLimit("voteIpHour", await clientIp());
  const input = voteInput.parse(await req.json());
  return castVote(slug, viewer, input);
});
