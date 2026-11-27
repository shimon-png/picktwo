import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { getCurrentUser, isAdmin } from "@/server/viewer";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { getEconomy } from "@/server/services/config";
import { answersLeftFor, isPlus, listThreads, pickbotAccess } from "@/server/services/pickbot";
import { profileProgressFor } from "@/server/services/profile-progress";
import { ProfileBar } from "@/components/taste/ProfileBar";
import { AskComposer } from "@/components/pickbot/AskComposer";
import { PickbotHistory } from "@/components/pickbot/History";
import { presetById } from "@/lib/asking";

export const metadata = { title: "Ask Pickbot" };
export const dynamic = "force-dynamic";

/** Ask (Pickbot PRD S1): the profile bar, the question box with examples, and your past questions. */
export default async function AskPage({ searchParams }: { searchParams: Promise<{ preset?: string; q?: string; mine?: string }> }) {
  // "People like you are asking" (lib/asking.ts): the tapped question comes filled in, through sign-up and onboarding.
  const sp = await searchParams;
  const preset = presetById(sp.preset);
  // An AI-written question from the deck card comes as plain text.
  const typed = !preset && typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const here = preset ? `/ask?preset=${preset.id}` : typed ? `/ask?q=${encodeURIComponent(typed)}` : "/ask";
  const user = await getCurrentUser();
  if (user && profileIncomplete(user)) redirect(onboardingUrl(here));
  const access = await pickbotAccess(user);
  if (!access.ok) {
    const signin = access.reason === "signin";
    return (
      <div className="space-y-4 pt-2">
        <Intro />
        <div className="card space-y-3 px-5 py-5">
          {signin ? (
            <>
              <p className="text-[15px] text-ink/80">Sign up to ask Pickbot. It learns your taste from the battles you vote on, so your answers fit you.</p>
              <Link href={`/signin?callbackUrl=${encodeURIComponent(here)}`} className="btn-primary inline-flex">
                Sign up to ask
              </Link>
            </>
          ) : (
            <p className="text-[15px] text-ink/80">
              Pickbot is coming soon. Keep voting: every battle you answer makes your future answers fit you better.
              {access.reason === "unconfigured" && isAdmin(user) && <span className="mt-2 block text-[13px] text-b">Admin: add ANTHROPIC_API_KEY in Vercel to turn it on.</span>}
            </p>
          )}
        </div>
      </div>
    );
  }
  const [progress, left, threads, e] = await Promise.all([profileProgressFor({ user, deviceId: null }), answersLeftFor(user!), listThreads(user), getEconomy()]);
  return (
    <div className="space-y-5 pt-2">
      {progress && !progress.complete && <ProfileBar p={progress} place="ask" />}
      <Intro />
      {preset ? <AskComposer initialText={preset.q} preset={preset.id} /> : typed ? <AskComposer initialText={typed} /> : <AskComposer examples focus={sp.mine === "1"} />}
      <p className="flex items-center gap-1.5 text-[12px] text-ink/50">
        <Lock className="size-3.5" /> Your questions will be anonymized and get the crowd’s answer as well! You can always opt-out.
        {left != null && !isPlus(user) && (
          <span className="ml-auto">
            {left} of {e.pickbotFreePerDay} free answers left today
          </span>
        )}
      </p>
      {left === 0 && <div className="card px-4 py-3 text-[14px]">You’ve used today’s free answers. Come back tomorrow for more.</div>}
      <PickbotHistory rows={threads} />
    </div>
  );
}

function Intro() {
  return (
    <div className="space-y-2">
      <h1 className="flex items-center gap-2 text-[34px] leading-none">
        <Sparkles className="size-7 text-violet" aria-hidden /> Ask Pickbot
      </h1>
      <p className="text-[15px] text-ink/75">
        Stuck on a choice? Ask in your own words. Add photos if it helps. I’ll answer <i>for you</i>, and the crowd can weigh in.
      </p>
    </div>
  );
}
