import { redirect } from "next/navigation";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { getViewer } from "@/server/viewer";
import { getFeed } from "@/server/services/feed";
import { getEconomy } from "@/server/services/config";
import { guestVotesLeft } from "@/server/services/votes";
import { softGateFor } from "@/server/services/gate-test";
import { profileProgressFor } from "@/server/services/profile-progress";
import { SwipeDeck } from "@/components/battle/SwipeDeck";
import { Tutorial } from "@/components/layout/Tutorial";

export const metadata = { title: "Vote" };
export const dynamic = "force-dynamic";

export default async function VotePage() {
  const viewer = await getViewer();
  if (viewer.user && profileIncomplete(viewer.user)) redirect(onboardingUrl("/vote"));
  const [items, economy, guestLeft, softGate, progress] = await Promise.all([
    getFeed(viewer, { limit: 20 }),
    getEconomy(),
    guestVotesLeft(viewer),
    softGateFor(viewer),
    profileProgressFor(viewer),
  ]);
  return (
    <>
      <SwipeDeck
      initial={items}
      signedIn={!!viewer.user}
      pp={viewer.user?.ppBalance ?? null}
      tiers={{ highAt: economy.tierHighAt, topAt: economy.tierTopAt }}
      guestLeft={guestLeft}
      guestLimit={economy.guestVoteLimit}
      softGate={softGate}
      likeYouMs={economy.likeYouResultMs}
      progress={progress}
      />
      <Tutorial signedIn={!!viewer.user} accountSeen={!!viewer.user?.tourSeenAt} />
    </>
  );
}
