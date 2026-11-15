import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import { getEconomy } from "@/server/services/config";
import { awaitingOutcome, countOpenLoops } from "@/server/services/points";
import { priorityTier } from "@/server/services/priority";
import { ComposeForm } from "@/components/compose/ComposeForm";
import { OpenLoopsList } from "@/components/priority/OpenLoopsList";

export const metadata = { title: "Post a battle" };

export default async function PostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/post");
  if (!user.onboardedAt) redirect("/onboarding?next=/post");
  const economy = await getEconomy();
  const [openLoops, awaiting] = await Promise.all([countOpenLoops(user.id, economy), awaitingOutcome(user.id)]);
  const tier = priorityTier(user.ppBalance, openLoops, economy.priorityCap);
  return (
    <div className="space-y-6">
      {openLoops >= 3 && (
        <section className="card space-y-3 border-b/40 p-4">
          <h2 className="font-display text-lg font-extrabold">Close the loop first?</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You have {openLoops} past decisions without an outcome. New battles from you are shown to far fewer people until you close them. It takes 5 seconds each.
          </p>
          <OpenLoopsList items={awaiting.map((a) => ({ ...a, deadline: a.deadline.toISOString() }))} />
        </section>
      )}
      <ComposeForm tier={tier} dataConsentDefault={user.dataConsent} accountConsent={user.dataConsent} />
    </div>
  );
}
