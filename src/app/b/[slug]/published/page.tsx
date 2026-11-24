import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, X, Zap } from "lucide-react";
import { getCurrentUser, isAdmin } from "@/server/viewer";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getBattleRow } from "@/server/services/battles";
import { getEconomy } from "@/server/services/config";
import { pointsTier } from "@/server/services/priority";
import { CopyLink, ShareGrid } from "@/components/battle/ShareButtons";
import { Bar } from "@/components/ui/Bar";
import { appUrl } from "@/lib/utils";

export const metadata = { title: "Your battle is live" };
export const dynamic = "force-dynamic";

export default async function PublishedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?callbackUrl=/b/${slug}`);
  const b = await getBattleRow(slug);
  if (!b) notFound();
  const postedAs = b.authorId !== user.id;
  if (postedAs && !isAdmin(user)) redirect(`/b/${slug}`);
  const [author] = postedAs ? await db.select({ handle: users.handle }).from(users).where(eq(users.id, b.authorId)) : [null];
  const economy = await getEconomy();
  const t = pointsTier(user.ppBalance, economy.tierHighAt, economy.tierTopAt);
  const url = appUrl(`/b/${slug}`);
  const close = (
    <div className="flex justify-end">
      <Link href="/you" className="-mr-2 rounded-lg p-2 text-ink hover:bg-surface" aria-label="Close, go to your battles">
        <X className="size-5" aria-hidden />
      </Link>
    </div>
  );

  if (b.status === "HIDDEN")
    return (
      <div className="space-y-3 pt-2">
        {close}
        <ShieldCheck className="size-8 text-accent" aria-hidden />
        <h1 className="display text-[26px]">Your battle is in review</h1>
        <p className="text-[15px] text-zinc-600">
          Our photo check wants a person to take a quick look before it goes public. That usually happens within a day, and you don’t need to do anything.
        </p>
        <Link href="/vote" className="btn-cta w-full">
          Vote while I wait
        </Link>
        <Link href={`/b/${slug}`} className="btn-ghost w-full">
          View my battle
        </Link>
      </div>
    );

  return (
    <div className="-mx-4 -mt-2 flex flex-col bg-gradient-to-b from-accent-900/70 to-page to-40% px-4 pb-6 pt-2">
      {close}
      <CheckCircle2 className="size-8 text-accent" aria-hidden />
      <h1 className="display mt-3 text-[26px]">Your battle is live</h1>
      {postedAs && <p className="mt-1 text-[13px] text-violet">Posted as @{author?.handle}</p>}
      <p className="mt-2 text-[15px] text-zinc-600">Friends answer fastest. Send it to two or three people who know the situation.</p>

      <div className="mt-6 space-y-3">
        <CopyLink url={url} />
        <ShareGrid url={url} title={b.title} />
      </div>

      <section className="card mt-8 p-4">
        <h2 className="text-[22px]">Get answered faster</h2>
        <p className="mt-1.5 text-[13px] text-zinc-600">
          {t.next ? (
            <>
              {t.toNext} <Zap className="inline size-3.5 fill-pp text-pp" aria-label="points" /> to {t.next} priority. Vote while you wait — each one moves your battle up.
            </>
          ) : (
            "You’re at Top priority — your battle goes to the front of the queue."
          )}
        </p>
        <Bar value={t.progress} className="mt-3" />
        <Link href="/vote" className="btn-accent-outline mt-3 w-full">
          Vote while I wait
        </Link>
      </section>
      <Link href={`/b/${slug}`} className="btn-ghost mt-3 w-full">
        View my battle
      </Link>
    </div>
  );
}
