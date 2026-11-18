import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/viewer";
import { getBattleRow } from "@/server/services/battles";
import { db } from "@/server/db";
import { options, outcomes } from "@/server/db/schema";
import { getEconomy } from "@/server/services/config";
import { ReportBackForm } from "@/components/battle/ReportBackForm";

export const metadata = { title: "Close the loop" };

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string }> }) {
  const { slug } = await params;
  const { c } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?callbackUrl=${encodeURIComponent(`/b/${slug}/report${c ? `?c=${c}` : ""}`)}`);
  const b = await getBattleRow(slug);
  if (!b) notFound();
  if (b.authorId !== user.id) redirect(`/b/${slug}`);
  const [opts, [existing], economy] = await Promise.all([
    db.select().from(options).where(eq(options.battleId, b.id)),
    db.select().from(outcomes).where(eq(outcomes.battleId, b.id)),
    getEconomy(),
  ]);
  const total = b.votesA + b.votesB;
  const A = opts.find((o) => o.side === "A")!;
  const B = opts.find((o) => o.side === "B")!;
  const prefill = c === "A" || c === "B" || c === "NEITHER" ? c : existing?.chosen;
  return (
    <ReportBackForm
      slug={slug}
      title={b.title}
      A={A}
      B={B}
      votes={{ a: b.votesA, b: b.votesB }}
      isOpen={b.status === "OPEN"}
      eligible={total >= economy.minVotesForLoop}
      minVotes={economy.minVotesForLoop}
      initial={{ chosen: prefill ?? null, thumb: existing?.thumb ?? null, note: existing?.note ?? "" }}
      editing={!!existing}
      fastEligible={b.status === "OPEN" || Date.now() - b.deadline.getTime() <= economy.loopClosedFastHours * 3600_000}
      rewards={{ loop: economy.loopClosedPoints, fast: economy.loopClosedFastBonus, note: economy.outcomeNotePoints, noteMin: economy.outcomeNoteMinChars }}
    />
  );
}
