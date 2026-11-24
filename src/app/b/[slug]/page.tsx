import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/server/viewer";
import { getBattleView, getBattleRow } from "@/server/services/battles";
import { AppError } from "@/server/errors";
import { BattleClient } from "@/components/battle/BattleClient";
import { DiscoverVote } from "@/components/battle/DiscoverVote";
import { appUrl } from "@/lib/utils";
import { db } from "@/server/db";
import { options } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { track } from "@/server/analytics";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBattleRow(slug);
  if (!b || b.status === "HIDDEN") return { title: "Battle not found" };
  if (b.visibility === "FRIENDS") return { title: "A friends-only battle", robots: { index: false } };
  const opts = await db.select().from(options).where(eq(options.battleId, b.id));
  const A = opts.find((o) => o.side === "A")?.label;
  const B = opts.find((o) => o.side === "B")?.label;
  const description = `${A} or ${B}? ${b.context ?? "Tap to vote — it takes one second."}`;
  return {
    title: b.title,
    description,
    openGraph: { title: `Help me choose: ${b.title}`, description, url: appUrl(`/b/${slug}`), type: "website" },
    twitter: { card: "summary_large_image", title: `Help me choose: ${b.title}`, description },
    robots: b.visibility === "LINK_ONLY" ? { index: false, follow: false } : undefined,
  };
}

export default async function BattlePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { src } = await searchParams;
  const viewer = await getViewer();
  let view;
  try {
    view = await getBattleView(slug, viewer);
  } catch (e) {
    if (e instanceof AppError && (e.code === "UNAUTHORIZED" || e.code === "FORBIDDEN"))
      return (
        <div className="card mx-auto mt-10 max-w-md space-y-4 p-6 text-center">
          <h1 className=" text-xl font-medium">🔒 Friends only</h1>
          <p className="text-zinc-600">{e.message}</p>
          {!viewer.user && (
            <Link className="btn-cta" href={`/signin?callbackUrl=/b/${slug}`}>
              Sign in
            </Link>
          )}
        </div>
      );
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (!view) notFound();
  track("battle_viewed", { battleId: view.id, source: src ?? "link" }, { userId: viewer.user?.id, deviceId: viewer.deviceId });
  const source = src === "feed" || src === "home" || src === "profile" || src === "discover" || src === "search" ? src : "link";
  // From Discover, not voted yet: a vote-only view (no scores or reasons until you vote), then back to Discover.
  if ((source === "discover" || source === "search") && !view.isOwner && !view.myVote) return <DiscoverVote initial={view} source={source} />;
  return <BattleClient initial={view} signedIn={!!viewer.user} shareUrl={appUrl(`/b/${slug}`)} source={source} />;
}
