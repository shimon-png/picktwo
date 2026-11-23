import { refreshEngagement } from "@/server/services/engagement";
import { closeDueBattles, sendReminders, decayPoints, dailyRollup } from "@/server/services/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOBS: Record<string, () => Promise<unknown>> = {
  "close-battles": () => closeDueBattles(),
  reminders: () => sendReminders(),
  decay: () => decayPoints(),
  rollups: () => dailyRollup(),
  engagement: () => refreshEngagement(),
  // Runs everything — used by the single daily cron on Vercel Hobby plans.
  daily: async () => ({
    closed: await closeDueBattles(),
    reminders: await sendReminders(),
    decayed: await decayPoints(),
    rollup: await dailyRollup(),
    engagement: await refreshEngagement(),
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
