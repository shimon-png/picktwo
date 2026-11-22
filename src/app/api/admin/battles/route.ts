import { z } from "zod";
import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { relaunchBattles } from "@/server/services/admin-battles";

/** Admin: relaunch selected battles, or every ended one, with a fresh deadline. */
export const POST = handler(async (req) => {
  await requireAdmin();
  const body = z
    .object({
      ids: z.array(z.string().min(1)).max(2000).optional(),
      allEnded: z.boolean().optional(),
      hours: z.number().int().min(1).max(24 * 30).optional(),
    })
    .parse(await req.json());
  return relaunchBattles(body);
});
