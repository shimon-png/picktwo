import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { exportPairwise } from "@/server/services/export";

export const GET = handler(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") || Date.now() - 30 * 86400_000);
  const to = new Date(url.searchParams.get("to") || Date.now());
  const body = await exportPairwise(from, to);
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson", "Content-Disposition": `attachment; filename="crowdpick-pairwise.jsonl"` },
  });
});
