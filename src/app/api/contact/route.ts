import { handler, clientIp } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { contactInput } from "@/lib/validators";
import { createContactMessage } from "@/server/services/contact";

export const POST = handler(async (req) => {
  const ip = await clientIp();
  await rateLimit("contactHour", ip);
  await rateLimit("contactDay", ip);
  const input = contactInput.parse(await req.json());
  // Spam traps: honeypot filled, or submitted faster than a human could type. Pretend success.
  if (input.website || (input.elapsedMs !== undefined && input.elapsedMs < 2500)) return { ok: true };
  const viewer = await getViewer();
  await createContactMessage({
    name: input.name,
    email: input.email,
    topic: input.topic,
    message: input.message,
    pageUrl: input.pageUrl,
    userId: viewer.user?.id ?? null,
    userAgent: req.headers.get("user-agent"),
  });
  return { ok: true };
});
