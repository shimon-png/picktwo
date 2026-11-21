import { handler } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { reportInput } from "@/lib/validators";
import { submitReport } from "@/server/services/reports";
import { track } from "@/server/analytics";

export const POST = handler(async (req) => {
  const viewer = await getViewer();
  await rateLimit("report", viewer.user?.id ?? viewer.deviceId ?? "anon");
  const input = reportInput.parse(await req.json());
  const { hidden } = await submitReport(input, viewer.user?.id ?? null);
  track("report_submitted", { targetType: input.targetType, reason: input.reason, hidden }, { userId: viewer.user?.id, deviceId: viewer.deviceId });
  return { ok: true, hidden };
});
