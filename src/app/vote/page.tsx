import { redirect } from "next/navigation";
import { getViewer } from "@/server/viewer";
import { getFeed } from "@/server/services/feed";
import { getEconomy } from "@/server/services/config";
import { SwipeDeck } from "@/components/battle/SwipeDeck";
import { CATEGORIES } from "@/lib/constants";

export const metadata = { title: "Vote" };
export const dynamic = "force-dynamic";

export default async function VotePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const cat = CATEGORIES.some((c) => c.id === category) ? category : undefined;
  const viewer = await getViewer();
  if (viewer.user && !viewer.user.onboardedAt) redirect("/onboarding?next=/vote");
  const [items, economy] = await Promise.all([getFeed(viewer, { category: cat, limit: 20 }), getEconomy()]);
  return (
    <SwipeDeck
      key={cat ?? "all"}
      initial={items}
      category={cat ?? null}
      signedIn={!!viewer.user}
      pp={viewer.user?.ppBalance ?? null}
      tiers={{ highAt: economy.tierHighAt, topAt: economy.tierTopAt }}
    />
  );
}
