import { z } from "zod";
import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { ADMIN_ACTIONS, resolveReport } from "@/server/services/reports";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { action } = z
    .object({ action: z.enum([...ADMIN_ACTIONS, "restore"]) })
    .transform((v) => ({ action: v.action === "restore" ? ("approve" as const) : v.action }))
    .parse(await req.json());
  await resolveReport(id, action, admin.id);
  return { ok: true };
});
