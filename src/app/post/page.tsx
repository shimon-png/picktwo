import Link from "next/link";
import { redirect } from "next/navigation";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { getCurrentUser, isAdmin } from "@/server/viewer";
import { getEconomy } from "@/server/services/config";
import { countOpenLoops, unreportedBattles } from "@/server/services/points";
import { canPostBattle } from "@/server/services/expertise";
import { ComposeForm } from "@/components/compose/ComposeForm";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "New battle" };

export default async function PostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/post");
  if (profileIncomplete(user)) redirect(onboardingUrl("/post"));
  const economy = await getEconomy();
  const [openLoops, unreported] = await Promise.all([countOpenLoops(user.id, economy), unreportedBattles(user.id)]);
  // Close-the-loop gate (admins keep the composer so they can still "post as" other profiles).
  if (!canPostBattle(unreported.length, economy.maxUnreportedBattles) && !isAdmin(user)) return <CloseLoopsFirst list={unreported} />;
  return (
    <ComposeForm
      pp={user.ppBalance}
      tiers={{ highAt: economy.tierHighAt, topAt: economy.tierTopAt }}
      openLoops={openLoops}
      isAdmin={isAdmin(user)}
    />
  );
}

function CloseLoopsFirst({ list }: { list: { slug: string; title: string; deadline: Date }[] }) {
  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-[28px] leading-tight">Close the loop first</h1>
      <p className="text-[15px] text-zinc-600">
        You have {list.length} finished battles waiting for your final pick. Tell the crowd what you went with and you can post again: each one you close
        frees up a new post.
      </p>
      <p className="text-[13px] text-zinc-500">Your answer is how voters find out if they called it, and how we spot the people who get it right.</p>
      <ul className="card divide-y divide-ink/8">
        {list.map((b) => (
          <li key={b.slug}>
            <Link href={`/b/${b.slug}/report`} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{b.title}</span>
                <span className="block text-xs text-zinc-500">Closed {timeAgo(b.deadline)}</span>
              </span>
              <span className="btn-primary !px-3 !py-1.5 text-xs">Report back</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/vote" className="block text-center text-[13px] text-accent">
        You can still vote meanwhile
      </Link>
    </div>
  );
}
