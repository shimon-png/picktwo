import { z } from "zod";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { respondToRequest } from "@/server/services/messages";

/** Accept or decline a message request from `handle`. */
export const POST = handler<{ handle: string }>(async (req, { params }) => {
  const user = await requireUser();
  await rateLimit("generic", user.id);
  const { handle } = await params;
  const { accept } = z.object({ accept: z.boolean() }).parse(await req.json());
  return respondToRequest(user, handle, accept);
});
