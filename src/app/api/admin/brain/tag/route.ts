import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { tagUntagged } from "@/server/services/tagging";

export const maxDuration = 60;

/** Admin: AI-tag the next 25 untagged battles (theme, stakes, traits). */
export const POST = handler(async () => {
  await requireAdmin();
  return tagUntagged(25);
});
