import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { loadZipIncome } from "@/server/services/passive";

export const maxDuration = 60;

/** Admin: (re)load Census median household income for every ZIP area (one request, ~33k rows). */
export const POST = handler(async () => {
  await requireAdmin();
  return loadZipIncome();
});
