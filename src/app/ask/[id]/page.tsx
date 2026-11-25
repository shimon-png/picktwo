import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import { threadView } from "@/server/services/pickbot";
import { AppError } from "@/server/errors";
import { PickbotThread } from "@/components/pickbot/Thread";

export const metadata = { title: "Pickbot" };
export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?callbackUrl=/ask/${id}`);
  try {
    const view = await threadView(user, id);
    return <PickbotThread initial={view} />;
  } catch (e) {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
}
