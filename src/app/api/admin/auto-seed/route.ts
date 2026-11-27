import { z } from "zod";
import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { autoSeedStatus, runAutoSeed } from "@/server/services/auto-seed";

export const maxDuration = 300;

/** Admin: auto-seeding status. */
export const GET = handler(async () => {
  await requireAdmin();
  return autoSeedStatus();
});

/** Admin: "check" = run the hourly check now; "force" = write a batch now, ignoring the threshold and cooldown. */
export const POST = handler(async (req) => {
  await requireAdmin();
  const { action } = z.object({ action: z.enum(["check", "force"]) }).parse(await req.json());
  const result = await runAutoSeed({ force: action === "force", budgetMs: 240_000 });
  return { result, status: await autoSeedStatus() };
});
