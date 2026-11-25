import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/viewer";
import { getEconomy } from "@/server/services/config";
import { isPlus } from "@/server/services/pickbot";
import { plusConfigured } from "@/server/services/plus";
import { PlusButton } from "@/components/app/PlusButton";

export const metadata = { title: "Pickbot Plus" };
export const dynamic = "force-dynamic";

/** Pickbot Plus (PRD §12): unlimited answers, more crowd questions a day. $4.99/month through Stripe. */
export default async function PlusPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [user, e, sp] = await Promise.all([getCurrentUser(), getEconomy(), searchParams]);
  const plus = isPlus(user);
  const perks = [
    "Unlimited Pickbot answers",
    `Ask the crowd up to ${e.pickbotPlusCrowdPerDay} times a day (free: ${e.pickbotCrowdPerDay})`,
    "Photo-heavy questions and follow-ups without limits",
    "Support a small team building a kinder way to decide",
  ];
  return (
    <div className="space-y-5 pt-2">
      <h1 className="flex items-center gap-2 text-[34px] leading-none">
        <Sparkles className="size-7 text-violet" aria-hidden /> Pickbot Plus
      </h1>
      {sp.welcome && plus && <p className="rounded-[12px] bg-green-soft px-4 py-3 text-[15px] text-green">Welcome to Plus! Ask away.</p>}
      <div className="card space-y-4 px-5 py-5">
        <p className="text-[15px] text-ink/75">Free gets you {e.pickbotFreePerDay} Pickbot answers a day. Plus takes the limit off.</p>
        <ul className="space-y-2">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[15px]">
              <Check className="mt-0.5 size-4 shrink-0 text-green" /> {p}
            </li>
          ))}
        </ul>
        <p className="font-display text-[32px] leading-none">
          $4.99<span className="text-[15px] text-ink/60"> / month · cancel any time</span>
        </p>
        {!user ? (
          <Link href="/signin?callbackUrl=/plus" className="btn-primary block text-center">
            Sign up first
          </Link>
        ) : plus ? (
          <div className="space-y-2">
            <p className="text-[14px] text-ink/70">You have Plus until {user.plusUntil!.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. It renews by itself unless you cancel.</p>
            {user.stripeCustomerId && <PlusButton manage>Manage subscription</PlusButton>}
          </div>
        ) : plusConfigured() ? (
          <PlusButton>Get Plus</PlusButton>
        ) : (
          <p className="text-[14px] text-ink/60">Plus is coming soon.</p>
        )}
        <p className="text-[12px] text-ink/50">Payments are handled by Stripe. We never see your card number.</p>
      </div>
      <Link href="/ask" className="text-[14px] text-accent">
        ← Back to Pickbot
      </Link>
    </div>
  );
}
