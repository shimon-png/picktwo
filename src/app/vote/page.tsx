import { getViewer } from "@/server/viewer";
import { getFeed } from "@/server/services/feed";
import { SwipeDeck } from "@/components/battle/SwipeDeck";
import { CATEGORIES } from "@/lib/constants";

export const metadata = { title: "Vote" };
export const dynamic = "force-dynamic";

export default async function VotePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const cat = CATEGORIES.some((c) => c.id === category) ? category : undefined;
  const viewer = await getViewer();
  const items = await getFeed(viewer, { category: cat, limit: 20 });
  return <SwipeDeck initial={items} category={cat ?? null} signedIn={!!viewer.user} />;
}
