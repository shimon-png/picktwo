import { z } from "zod";
import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { setContactStatus } from "@/server/services/contact";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { action } = z.object({ action: z.enum(["handled", "reopen"]) }).parse(await req.json());
  await setContactStatus(id, action === "handled" ? "HANDLED" : "NEW", admin.id);
  return { ok: true };
});
