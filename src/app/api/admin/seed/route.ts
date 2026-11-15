import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { seed } from "@/server/seed";

/** One-time seeding from the admin panel (categories, config, demo battles). Safe to re-run. */
export const POST = handler(async (req) => {
  await requireAdmin();
  const demo = new URL(req.url).searchParams.get("demo") !== "0";
  return seed({ demo });
});
