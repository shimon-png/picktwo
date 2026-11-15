import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { markAllRead } from "@/server/services/notifications";

export const POST = handler(async () => {
  await markAllRead((await requireUser()).id);
  return { ok: true };
});
