import { TITLE_MAX } from "@/lib/constants";
import { z } from "zod";
import { handler, json } from "@/server/api";
import { getViewer, requireUser, isAdmin } from "@/server/viewer";
import { getBattleView, editBattle, closeEarly, extendDeadline, deleteBattle } from "@/server/services/battles";
import { AppError } from "@/server/errors";

export const GET = handler<{ slug: string }>(async (_req, { params }) => {
  const { slug } = await params;
  const view = await getBattleView(slug, await getViewer());
  if (!view) throw new AppError("NOT_FOUND", "Battle not found");
  return view;
});

const patch = z.object({
  action: z.enum(["edit", "close", "extend"]),
  title: z.string().trim().min(3).max(TITLE_MAX).optional(),
  context: z.string().trim().max(280).optional(),
  hours: z.number().min(1).max(168).optional(),
});

export const PATCH = handler<{ slug: string }>(async (req, { params }) => {
  const { slug } = await params;
  const user = await requireUser();
  const body = patch.parse(await json(req));
  if (body.action === "edit") await editBattle(slug, user, body);
  if (body.action === "close") await closeEarly(slug, user);
  if (body.action === "extend") await extendDeadline(slug, user, body.hours ?? 24);
  return { ok: true };
});

export const DELETE = handler<{ slug: string }>(async (_req, { params }) => {
  const { slug } = await params;
  const user = await requireUser();
  await deleteBattle(slug, user, isAdmin(user));
  return { ok: true };
});
