import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { tagUntagged } from "@/server/services/tagging";

export const maxDuration = 60;

/** Admin: AI-tag the next 100 untagged battles (theme, stakes, traits), 10 at a time so it fits in a minute. */
export const POST = handler(async () => {
  await requireAdmin();
  return tagUntagged(100, 10);
});
