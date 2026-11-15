import { z } from "zod";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { unfurl } from "@/server/unfurl";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit("unfurl", user.id);
  const { url } = z.object({ url: z.string().url().max(2000) }).parse(await req.json());
  return unfurl(url);
});
