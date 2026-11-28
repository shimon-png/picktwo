import { redirect } from "next/navigation";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { getViewer } from "@/server/viewer";
import { cookies } from "next/headers";
import { getDeck } from "@/server/services/feed";
import { topicsArm } from "@/server/services/topics-test";
import { MIX, TOPIC_COOKIE, deckTopic } from "@/lib/topics";
import { getEconomy } from "@/server/services/config";
import { guestVotesLeft } from "@/server/services/votes";
import { softGateFor } from "@/server/services/gate-test";
import { profileProgressFor } from "@/server/services/profile-progress";
import { pickbotPromoFor } from "@/server/services/pickbot";
import { askingFor } from "@/server/services/asking";
import { SwipeDeck } from "@/components/battle/SwipeDeck";
import { Tutorial } from "@/components/layout/Tutorial";

export const metadata = { title: "Vote" };
export const dynamic = "force-dynamic";

export default async function VotePage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const viewer = await getViewer();
  if (viewer.user && profileIncomplete(viewer.user)) redirect(onboardingUrl("/vote"));
  // Topics A/B test (lib/topics.ts): the "topics" group gets the chip row; ?topic= (homepage tiles, ad links) or the
  // remembered topic picks the deck. The old deck (control) always shows everything.
  const arm = await topicsArm(viewer);
  const sp = await searchParams;
  const topic = arm === "topics" ? deckTopic(sp.topic ?? (await cookies()).get(TOPIC_COOKIE)?.value) : MIX;
  const [{ items, counts }, economy, guestLeft, softGate, progress, promo, asking] = await Promise.all([
    getDeck(viewer, { limit: 20, topic }),
    getEconomy(),
    guestVotesLeft(viewer),
    softGateFor(viewer),
    profileProgressFor(viewer),
    pickbotPromoFor(viewer.user),
    askingFor(viewer).catch(() => null),
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
      pickbotPromo={promo}
      asking={asking}
      skipRescueAfter={economy.skipRescueAfter}
      topics={
        arm === "topics"
          ? {
              current: topic,
              counts,
              pickerAt: economy.topicPickerAt,
              streakRun: economy.topicStreakRun,
              streakSkips: economy.topicStreakSkips,
              gateAt: economy.topicGateAt,
              softEvery: economy.softGateEvery,
            }
          : null
      }
      />
      <Tutorial signedIn={!!viewer.user} accountSeen={!!viewer.user?.tourSeenAt} />
    </>
  );
}
