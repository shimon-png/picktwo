import { createHash } from "node:crypto";
import { and, eq, gte, lte, isNotNull, inArray } from "drizzle-orm";
import { db } from "../db";
import { battles, options, votes, users, outcomes, reputations } from "../db/schema";

const hash = (s: string) => "h_" + createHash("sha256").update((process.env.AUTH_SECRET || "") + s).digest("hex").slice(0, 16);

/** Scrub obvious PII from free text (PRD 13.5). */
export function scrub(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]")
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/@\w{2,}/g, "[handle]");
}

/** JSONL of consented pairwise preference records: only where both battle and voter consented. */
export async function exportPairwise(from: Date, to: Date): Promise<string> {
  const rows = await db
    .select({ v: votes, b: battles, voterKidAges: users.kidAges, voterCountry: users.country, voterConsent: users.dataConsent })
    .from(votes)
    .innerJoin(battles, eq(battles.id, votes.battleId))
    .innerJoin(users, eq(users.id, votes.userId))
    .where(
      and(
        isNotNull(votes.userId),
        eq(battles.dataConsent, true),
        eq(users.dataConsent, true),
        inArray(battles.status, ["OPEN", "CLOSED"]),
        gte(votes.createdAt, from),
        lte(votes.createdAt, to),
      ),
    )
    .limit(100_000);
  const bIds = [...new Set(rows.map((r) => r.b.id))];
  const [opts, outs, reps] = await Promise.all([
    bIds.length ? db.select().from(options).where(inArray(options.battleId, bIds)) : [],
    bIds.length ? db.select().from(outcomes).where(inArray(outcomes.battleId, bIds)) : [],
    db.select().from(reputations),
  ]);
  const lines: string[] = [];
  for (const { v, b, voterKidAges, voterCountry } of rows) {
    const A = opts.find((o) => o.battleId === b.id && o.side === "A");
    const B = opts.find((o) => o.battleId === b.id && o.side === "B");
    const o = outs.find((x) => x.battleId === b.id);
    const rep = reps.find((r) => r.userId === v.userId && r.categoryId === b.categoryId);
    const total = b.votesA + b.votesB;
    lines.push(
      JSON.stringify({
        battle_id: hash(b.id),
        category: b.categoryId,
        context: scrub(b.context),
        tags: b.tags,
        option_a: { label: scrub(A?.label), price: A?.priceCents != null ? A.priceCents / 100 : null },
        option_b: { label: scrub(B?.label), price: B?.priceCents != null ? B.priceCents / 100 : null },
        voter: { hash: hash(v.userId!), kid_ages: voterKidAges, country: voterCountry, category_reputation: rep?.score ?? null },
        vote: v.side,
        reason: scrub(v.reason),
        dwell_ms: v.dwellMs,
        outcome: o ? { chosen: o.chosen, thumb: o.thumb, note_scrubbed: scrub(o.note) } : null,
        crowd: total ? { a: Math.round((b.votesA / total) * 100), b: Math.round((b.votesB / total) * 100), n: total } : { a: 0, b: 0, n: 0 },
        created_at: v.createdAt.toISOString(),
      }),
    );
  }
  return lines.join("\n");
}
