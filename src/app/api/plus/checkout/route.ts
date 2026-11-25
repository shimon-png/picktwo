import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { plusCheckout } from "@/server/services/plus";

export const POST = handler(async () => {
  const user = await requireUser();
  await rateLimit("generic", `plus:${user.id}`);
  return plusCheckout(user);
});
