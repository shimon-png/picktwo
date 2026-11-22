import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { getThread } from "@/server/services/messages";

/** New messages in a conversation since `?after=` (ISO time). Marks them read. Used for polling. */
export const GET = handler<{ handle: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { handle } = await params;
  const after = new URL(req.url).searchParams.get("after") ?? undefined;
  const t = await getThread(user, handle, { after });
  return { messages: t.messages, canSend: t.canSend, notice: t.notice };
});
