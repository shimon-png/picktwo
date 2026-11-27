import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { battles, options } from "../db/schema";
import Anthropic from "@anthropic-ai/sdk";
import { parseBrainTags, taggingPrompt, type BrainTags } from "@/lib/brain-tags";

/**
 * AI tags for the data brain (Alex, Nov 23 2026: "auto-tag with AI when posted"). Theme, stakes, decision type,
 * traits each option suggests, brands. Stored in battle.tags.brain; never shown to users. Uses OPENAI_API_KEY
 * (model: TAGGING_MODEL, default below). Without a key it does nothing; errors never affect posting.
 */
const MODEL = () => process.env.TAGGING_MODEL || "gpt-4o-mini";

/** Fallback tagger when OpenAI is missing or failing (Nov 27 2026: taste wheels stayed empty because no tags landed). */
const CLAUDE_MODEL = () => process.env.TAGGING_CLAUDE_MODEL || "claude-haiku-5-5";

export function taggingEnabled() {
  return (!!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY) && process.env.TAGGING_PROVIDER !== "none";
}

let lastError: string | null = null;

async function askModel(prompt: { system: string; user: string }): Promise<{ raw: unknown; model: string }> {
  if (process.env.OPENAI_API_KEY && process.env.TAGGING_PROVIDER !== "claude") {
    try {
      return { raw: await askOpenAI(prompt), model: MODEL() };
    } catch (e) {
      lastError = `OpenAI: ${(e as Error).message}`.slice(0, 300);
      if (!process.env.ANTHROPIC_API_KEY) throw e;
    }
  }
  return { raw: await askClaude(prompt), model: CLAUDE_MODEL() };
}

let claude: Anthropic | null = null;
async function askClaude(prompt: { system: string; user: string }): Promise<unknown> {
  claude ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const msg = await claude.messages.create(
      { model: CLAUDE_MODEL(), max_tokens: 600, system: prompt.system + "\nReply with the JSON object only, no prose.", messages: [{ role: "user", content: prompt.user }] },
      { timeout: 20_000 },
    );
    const t = msg.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
    const m = t.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : "{}");
  } catch (e) {
    lastError = `Claude: ${(e as Error).message}`.slice(0, 300);
    throw e;
  }
}

async function askOpenAI(prompt: { system: string; user: string }): Promise<unknown> {
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
    const { raw, model } = await askModel(
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
    const tags = parseBrainTags(raw, model);
    // Merge into tags without touching other keys (targeting etc.).
    await db
      .update(battles)
      .set({ tags: sql`COALESCE(${battles.tags}, '{}'::jsonb) || jsonb_build_object('brain', ${JSON.stringify(tags)}::jsonb)` })
      .where(eq(battles.id, battleId));
    return tags;
  } catch (e) {
    console.error("[tagging]", battleId, e);
    lastError ??= (e as Error).message.slice(0, 300);
    return null;
  }
}

/** Battles still needing tags: none yet, or older tags without the taste axes (re-tagged once). */
const NEEDS_TAGS = sql`NOT COALESCE(${battles.tags}->'brain' ? 'axes', false)`;

export async function untaggedCount(): Promise<number> {
  const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM battle WHERE status <> 'DELETED' AND ${NEEDS_TAGS}`);
  return r?.n ?? 0;
}

/**
 * Tag up to `limit` untagged battles, a few at a time. Open battles (the ones the deck can show) first, then most-voted, then newest: taste profiles and the Brain
 * read tags off the battles people actually voted on, so those go before fresh seeds nobody has seen yet.
 */
export async function tagUntagged(limit = 25, parallel = 5): Promise<{ tagged: number; failed: number; remaining: number; enabled: boolean; error?: string | null }> {
  if (!taggingEnabled()) return { tagged: 0, failed: 0, remaining: await untaggedCount(), enabled: false };
  lastError = null;
  const rows = await db
    .select({ id: battles.id })
    .from(battles)
    .where(and(ne(battles.status, "DELETED"), NEEDS_TAGS))
    .orderBy(sql`CASE WHEN ${battles.status} = 'OPEN' THEN 0 ELSE 1 END`, sql`(${battles.votesA} + ${battles.votesB}) DESC`, sql`${battles.createdAt} DESC`)
    .limit(limit);
  let tagged = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += parallel) {
    const out = await Promise.all(rows.slice(i, i + parallel).map((r) => tagBattle(r.id)));
    out.forEach((t) => (t ? tagged++ : failed++));
  }
  const out = { tagged, failed, remaining: await untaggedCount(), enabled: true, error: lastError };
  // Last run, for the Brain's tagging line (so a broken key shows up instead of silently empty taste wheels).
  await db.execute(sql`
    INSERT INTO app_config (key, value) VALUES ('tagging_status', ${JSON.stringify({ ...out, at: new Date().toISOString() })}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
  if (failed) console.error("[tagging] run", out);
  return out;
}

export async function taggingStatus(): Promise<{ at: string; tagged: number; failed: number; remaining: number; error?: string | null } | null> {
  const [r] = await db.execute<{ value: never }>(sql`SELECT value FROM app_config WHERE key = 'tagging_status'`);
  return r?.value ?? null;
}

/** For analysis helpers: tags of several battles. */
export async function brainTagsFor(ids: string[]) {
  if (!ids.length) return new Map<string, BrainTags>();
  const rows = await db.select({ id: battles.id, tags: battles.tags }).from(battles).where(inArray(battles.id, ids));
  return new Map(rows.filter((r) => r.tags?.brain).map((r) => [r.id, r.tags.brain as BrainTags]));
}
