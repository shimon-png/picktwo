import { refreshEngagement } from "@/server/services/engagement";
import { tagUntagged } from "@/server/services/tagging";
import { sendWinbacks } from "@/server/services/winback";
import { closeDueBattles, sendReminders, decayPoints, dailyRollup } from "@/server/services/jobs";
import { runDailyEmails, runHourlyEmails } from "@/server/services/lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOBS: Record<string, () => Promise<unknown>> = {
  "close-battles": () => closeDueBattles(),
  reminders: () => sendReminders(),
  decay: () => decayPoints(),
  rollups: () => dailyRollup(),
  engagement: () => refreshEngagement(),
  tagging: () => tagUntagged(60),
  winback: () => sendWinbacks(),
  // Vercel Pro: every hour. Closes battles on time and sends the time-based emails (docs/emails.md).
  hourly: async () => ({
    closed: await closeDueBattles(),
    emails: await runHourlyEmails(),
  }),
  // Once a day.
  daily: async () => ({
    closed: await closeDueBattles(),
    reminders: await sendReminders(),
    decayed: await decayPoints(),
    rollup: await dailyRollup(),
    engagement: await refreshEngagement(),
    tagging: await tagUntagged(40),
    winback: await sendWinbacks(),
    emails: await runDailyEmails(),
  }),
};

export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: { code: "FORBIDDEN", message: "Bad cron secret" } }, { status: 403 });
  const fn = JOBS[job];
  if (!fn) return Response.json({ error: { code: "NOT_FOUND", message: "Unknown job" } }, { status: 404 });
  const result = await fn();
  return Response.json({ ok: true, job, result });
}
