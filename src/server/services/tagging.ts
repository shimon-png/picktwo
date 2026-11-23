import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { battles, options } from "../db/schema";
import { parseBrainTags, taggingPrompt, type BrainTags } from "@/lib/brain-tags";

/**
 * AI tags for the data brain (Alex, Nov 23 2026: "auto-tag with AI when posted"). Theme, stakes, decision type,
 * traits each option suggests, brands. Stored in battle.tags.brain; never shown to users. Uses OPENAI_API_KEY
 * (model: TAGGING_MODEL, default below). Without a key it does nothing; errors never affect posting.
 */
const MODEL = () => process.env.TAGGING_MODEL || "gpt-4o-mini";

export function taggingEnabled() {
  return !!process.env.OPENAI_API_KEY && process.env.TAGGING_PROVIDER !== "none";
}

async function askModel(prompt: { system: string; user: string }): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`tagging HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

/** Tag one battle and save it. Returns the tags, or null when tagging is off or failed. */
export async function tagBattle(battleId: string): Promise<BrainTags | null> {
  if (!taggingEnabled()) return null;
  try {
    const [b] = await db.select().from(battles).where(eq(battles.id, battleId));
    if (!b) return null;
    const opts = await db.select().from(options).where(eq(options.battleId, battleId));
    const A = opts.find((o) => o.side === "A");
    const B = opts.find((o) => o.side === "B");
    if (!A || !B) return null;
    const raw = await askModel(
      taggingPrompt({
        title: b.title,
        context: b.context,
        labelA: A.label,
        labelB: B.label,
        descA: A.description,
        descB: B.description,
        hasPhotos: !!(A.imageUrl || B.imageUrl),
      }),
    );
    const tags = parseBrainTags(raw, MODEL());
    // Merge into tags without touching other keys (targeting etc.).
    await db
      .update(battles)
      .set({ tags: sql`COALESCE(${battles.tags}, '{}'::jsonb) || jsonb_build_object('brain', ${JSON.stringify(tags)}::jsonb)` })
      .where(eq(battles.id, battleId));
    return tags;
  } catch (e) {
    console.error("[tagging]", battleId, e);
    return null;
  }
}

export async function untaggedCount(): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM battle WHERE status <> 'DELETED' AND NOT (tags ? 'brain')`);
  return r?.n ?? 0;
}

/** Tag up to `limit` untagged battles (newest first), a few at a time. */
export async function tagUntagged(limit = 25): Promise<{ tagged: number; failed: number; remaining: number; enabled: boolean }> {
  if (!taggingEnabled()) return { tagged: 0, failed: 0, remaining: await untaggedCount(), enabled: false };
  const rows = await db
    .select({ id: battles.id })
    .from(battles)
    .where(and(ne(battles.status, "DELETED"), sql`NOT (${battles.tags} ? 'brain')`))
    .orderBy(sql`${battles.createdAt} DESC`)
    .limit(limit);
  let tagged = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += 5) {
    const out = await Promise.all(rows.slice(i, i + 5).map((r) => tagBattle(r.id)));
    out.forEach((t) => (t ? tagged++ : failed++));
  }
  return { tagged, failed, remaining: await untaggedCount(), enabled: true };
}

/** For analysis helpers: tags of several battles. */
export async function brainTagsFor(ids: string[]) {
  if (!ids.length) return new Map<string, BrainTags>();
  const rows = await db.select({ id: battles.id, tags: battles.tags }).from(battles).where(inArray(battles.id, ids));
  return new Map(rows.filter((r) => r.tags?.brain).map((r) => [r.id, r.tags.brain as BrainTags]));
}
