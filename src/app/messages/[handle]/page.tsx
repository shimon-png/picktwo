import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { getThread } from "@/server/services/messages";
import { AppError } from "@/server/errors";
import { Thread } from "@/components/messages/Thread";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?callbackUrl=/messages/${handle}`);
  if (profileIncomplete(user)) redirect(onboardingUrl(`/messages/${handle}`));
  let t;
  try {
    t = await getThread(user, handle);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return <Thread key={t.other.id} other={t.other} initial={t.messages} canSend={t.canSend} notice={t.notice} iBlocked={t.iBlocked} />;
}
