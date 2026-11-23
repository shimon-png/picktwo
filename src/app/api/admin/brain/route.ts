import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { refreshEngagement } from "@/server/services/engagement";

/** Admin: recompute the engagement score now, back-filling returns from all history. */
export const POST = handler(async () => {
  await requireAdmin();
  return refreshEngagement({ backfillDays: 3650 });
});
