import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { messageReportInput } from "@/lib/validators";
import { receivedMessageText } from "@/server/services/messages";
import { submitReport } from "@/server/services/reports";
import { AppError } from "@/server/errors";
import { track } from "@/server/analytics";

/** Report a message you received. Filed against the sender (a USER report) with the message text attached for admins. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit("report", user.id);
  const input = messageReportInput.parse(await req.json());
  const m = await receivedMessageText(user, input.messageId);
  if (!m) throw new AppError("NOT_FOUND", "Message not found");
  await submitReport({ targetType: "USER", targetId: m.senderId, reason: input.reason, details: `Direct message: "${m.body.slice(0, 450)}"` }, user.id);
  track("report_submitted", { targetType: "MESSAGE", reason: input.reason }, { userId: user.id });
  return { ok: true };
});
