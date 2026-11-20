import { redirect } from "next/navigation";
import { getViewer } from "@/server/viewer";
import { getFeed } from "@/server/services/feed";
import { getEconomy } from "@/server/services/config";
import { SwipeDeck } from "@/components/battle/SwipeDeck";

export const metadata = { title: "Vote" };
export const dynamic = "force-dynamic";

export default async function VotePage() {
  const viewer = await getViewer();
  if (viewer.user && !viewer.user.onboardedAt) redirect("/onboarding?next=/vote");
  const [items, economy] = await Promise.all([getFeed(viewer, { limit: 20 }), getEconomy()]);
  return (
    <SwipeDeck
      initial={items}
      signedIn={!!viewer.user}
      pp={viewer.user?.ppBalance ?? null}
      tiers={{ highAt: economy.tierHighAt, topAt: economy.tierTopAt }}
    />
  );
}
