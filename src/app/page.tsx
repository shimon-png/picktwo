import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { getViewer } from "@/server/viewer";
import { getFeed } from "@/server/services/feed";
import { getEconomy } from "@/server/services/config";
import { HeroBattle } from "@/components/battle/HeroBattle";
import { track } from "@/server/analytics";
import { TONE_CLASSES, type Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getViewer();
  const user = viewer.user;
  if (user && !user.onboardedAt) redirect("/onboarding");
  // Signed in: the Vote stack is home.
  if (user) redirect("/vote");

  track("landing_viewed", {}, { deviceId: viewer.deviceId });
  const [feed, economy] = await Promise.all([getFeed({ user: null, deviceId: viewer.deviceId }, { limit: 1 }), getEconomy()]);
  const live = feed[0];
  const asker = live ? (live.authorName?.split(" ")[0] ?? (live.authorHandle ? `@${live.authorHandle}` : null)) : null;

  const steps: [string, Tone, string, string][] = [
    ["01", "blue", "Post two options", "Photos, links or just names. Add a line of context if you like."],
    ["02", "pink", "Get votes fast", "Friends by link, then parents of kids the same age."],
    ["03", "teal", "See the why", "One-line reasons; the most helpful rise."],
    ["04", "violet", "Close the loop", "Say which you picked and how it went."],
  ];

  return (
    <div className="-mx-4 -mt-2">
      <section className="bg-gradient-to-b from-accent-900/70 to-white px-4 pb-6 pt-6">
        <span className="tag bg-pink-soft text-pink">
          <Gift className="size-3.5" aria-hidden /> Holiday gift season is here
        </span>
        <h1 className="display mt-4 text-[38px]">
          Can’t decide?
          <br />
          <span className="text-accent-400">Ask people like you.</span>
        </h1>
        <p className="mt-3 text-[15px] text-zinc-600">{asker ? `Try it — ${asker} needs a second opinion.` : "Post two options and get votes in minutes."}</p>
        {live && (
          <div className="mt-5">
            <HeroBattle b={live} />
          </div>
        )}
      </section>

      <section className="px-4 pb-8 pt-4">
        <p className="text-[17px] leading-relaxed text-zinc-800">
          Your turn. Post two options and get votes from friends and parents like you — in minutes.
        </p>
        <Link href="/signin?callbackUrl=/post" className="btn-primary mt-4 w-full py-3">
          Post a battle
        </Link>
        <p className="mt-2 text-center text-xs text-zinc-500">Free · voting needs no account</p>
      </section>

      <section className="mx-4 border-t border-ink/10 pb-8 pt-8">
        <h2 className="text-xl">How it works</h2>
        <ol className="mt-5 space-y-5">
          {steps.map(([n, tone, title, line]) => (
            <li key={n} className="flex gap-3">
              <span className={cn("flex size-[26px] shrink-0 items-center justify-center rounded-md text-xs", TONE_CLASSES[tone].solid)}>{n}</span>
              <div>
                <div className="text-[15px] font-medium">{title}</div>
                <p className="text-[13px] text-zinc-500">{line}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-gradient-to-b from-section to-section-glow px-4 py-8">
        <h2 className="text-[22px] leading-tight">
          Help others,
          <br />
          get answered first.
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="rounded-md bg-pink px-2 py-1 text-white">Vote +{economy.votePoints}</span>
          <span className="text-ink/40" aria-hidden>
            →
          </span>
          <span className="rounded-md bg-violet px-2 py-1 text-white">Close loop +{economy.loopClosedPoints}</span>
          <span className="text-ink/40" aria-hidden>
            →
          </span>
          <span className="rounded-md bg-accent px-2 py-1 text-white">Top priority</span>
        </div>
        <p className="mt-4 text-[13px] text-zinc-700">More ⚡ puts your next question in front of voters sooner.</p>
      </section>

      <footer className="flex flex-wrap justify-center gap-4 px-4 py-6 text-xs text-zinc-400">
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/guidelines">Community guidelines</Link>
      </footer>
    </div>
  );
}
