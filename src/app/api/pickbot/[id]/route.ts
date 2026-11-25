import { handler } from "@/server/api";
import { getCurrentUser } from "@/server/viewer";
import { deleteThread, threadView } from "@/server/services/pickbot";

export const dynamic = "force-dynamic";

export const GET = handler<{ id: string }>(async (_req, { params }) => threadView(await getCurrentUser(), (await params).id));

export const DELETE = handler<{ id: string }>(async (_req, { params }) => deleteThread(await getCurrentUser(), (await params).id));
