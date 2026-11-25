import { z } from "zod";
import { handler } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { answerAbout } from "@/server/services/about";
import { ABOUT_QUESTION_IDS } from "@/lib/about";

const input = z.object({
  question: z.enum(ABOUT_QUESTION_IDS),
  /** null = skipped */
  answer: z.string().trim().max(12).nullable(),
  kidAges: z.array(z.string().max(12)).max(6).optional(),
  via: z.enum(["card", "signup", "settings"]).optional(),
});

/** Answer (or skip) an about-you card. Works for guests (saved on the browser) and accounts (saved on the profile). */
export const POST = handler(async (req) => {
  const viewer = await getViewer();
  await rateLimit("generic", `about:${viewer.user?.id ?? viewer.deviceId ?? "anon"}`);
  return answerAbout(viewer, input.parse(await req.json()));
});
