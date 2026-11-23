import { after } from "next/server";
import { handler } from "@/server/api";
import { emailDmRequest } from "@/server/services/lifecycle";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { messageInput } from "@/lib/validators";
import { sendMessage } from "@/server/services/messages";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit("messageMinute", user.id);
  await rateLimit("messageDay", user.id);
  const input = messageInput.parse(await req.json());
  const res = await sendMessage(user, input.to, input.body);
  if (res.requested)
    after(async () => {
      const [to] = await db.select({ id: users.id }).from(users).where(eq(users.handle, input.to.replace(/^@/, "").toLowerCase()));
      if (to) await emailDmRequest(to.id, { name: user.name, handle: user.handle });
    });
  return res;
});
