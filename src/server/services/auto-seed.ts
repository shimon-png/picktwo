/**
 * Auto-seeding (Alex + Shimon, Nov 26 2026). Hourly (`/api/cron/auto-seed`): find the person ranked
 * `autoSeedRank` (10th) by real votes in the last 7 days and count the battles left in their Vote deck. At
 * `autoSeedAt` (50) or fewer, write `autoSeedCount` (100) new seed battles, `autoSeedPhotoPct` (33%) with photos,
 * in the voice of the earlier hand-made batches, each with 15–20 seed votes from seed accounts.
 *
 * - Writing: Claude (ANTHROPIC_API_KEY; model AUTO_SEED_MODEL, default Sonnet 5.5) with live seed battles as
 *   examples; every draft passes `draftProblems()` (lengths, profanity filter, story ≠ title, no emoji or AI
 *   phrasing, no looks comparisons in photo battles) and a duplicate check against every existing title.
 * - Photos: Pexels API (PEXELS_API_KEY, free; photos free to use), searched deep (page 2–4), and Claude Haiku looks
 *   at the candidates and keeps only real photos that fit the option and every fact in the headline (no
 *   illustrations, text overlays, kids, celebrities or nudity). No key = the photo share is written as text.
 * - Posters: ~35% older seed posters whose voice matches (≤2 posts per batch), the rest new believable accounts.
 * - Fake activity stays out of real numbers the same way as before: battle ids `seed_auto_*`, email-less accounts,
 *   votes with source 'seed' (Brain Clean view and Journey skip them; "All data (AI view)" shows them).
 * - Batch progress lives in app_config key "auto_seed"; a run that runs out of time picks up next hour.
 * Undo one batch: DELETE FROM battle WHERE tags->'seed'->>'auto' = '<batch id>' (options and votes cascade).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { appConfig } from "../db/schema";
import { getEconomy } from "./config";
import { adminIds } from "./brain";
import { isAbusive } from "../moderation";
import { createId, createSlug } from "@/lib/id";
import { DEFAULT_CATEGORY_ID, TITLE_MAX } from "@/lib/constants";
import { SMALL_MODEL } from "@/lib/pickbot";
import {
  EMPTY_STATE,
  draftProblems,
  humanTime,
  isDuplicate,
  photoCount,
  planVotes,
  seedHandle,
  shouldStartBatch,
  topicPlan,
  voiceFromLabels,
  watchedRank,
  TOPIC_MIX,
  type SeedDraft,
  type SeedKind,
  type SeedState,
  type Voice,
} from "@/lib/auto-seed";

const KEY = "auto_seed";
const WRITER = () => process.env.AUTO_SEED_MODEL || "claude-sonnet-5-5";
const CHUNK = 10; // battles per writing call
const PARALLEL = 3; // writing calls at once
const SPECIAL_HANDLES = ["picktwo", "askedviapickbot", "crowdpick_trends"];

export const writerConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const photosConfigured = () => !!process.env.PEXELS_API_KEY;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const list = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);

// ---------- state ----------

export async function readState(): Promise<SeedState> {
  const [row] = await db.execute<{ value: SeedState }>(sql`SELECT value FROM app_config WHERE key = ${KEY}`);
  return { ...EMPTY_STATE, ...(row?.value ?? {}) };
}

async function saveState(s: SeedState) {
  await db
    .insert(appConfig)
    .values({ key: KEY, value: s })
    .onConflictDoUpdate({ target: appConfig.key, set: { value: s, updatedAt: new Date() } });
}

/** Claim the right to write until `until`; false when another run holds it. */
async function claim(until: Date): Promise<boolean> {
  await db.execute(sql`INSERT INTO app_config (key, value) VALUES (${KEY}, ${JSON.stringify(EMPTY_STATE)}::jsonb) ON CONFLICT DO NOTHING`);
  const rows = await db.execute<{ key: string }>(sql`
    UPDATE app_config SET value = jsonb_set(value, '{runningUntil}', to_jsonb(${until.toISOString()}::text)), updated_at = now()
    WHERE key = ${KEY} AND (value->>'runningUntil' IS NULL OR (value->>'runningUntil')::timestamptz < now())
    RETURNING key`);
  return rows.length > 0;
}

// ---------- the trigger ----------

/**
 * Real people's votes in the last 7 days (no seed votes, no flagged ones, no admins, no email-less accounts; a
 * guest browser that signed in counts as its account), top `rank`, and the battles left in the deck of the
 * person at `rank` (or the last one when fewer people voted): open, public, posted in the last 7 days (the deck's
 * window), not theirs, poster not banned, not voted or skipped by them.
 */
export async function deckCheck(rank: number) {
  const { ids: admins } = await adminIds();
  const notAdmin = admins.length ? sql`AND COALESCE(v.user_id, dv.user_id, '') NOT IN (${list(admins)})` : sql``;
  const top = await db.execute<{ who: string; n: number }>(sql`
    SELECT COALESCE(v.user_id, dv.user_id, v.device_id) AS who, count(*)::int AS n
    FROM vote v
    LEFT JOIN device dv ON dv.id = v.device_id
    LEFT JOIN "user" u ON u.id = COALESCE(v.user_id, dv.user_id)
    WHERE COALESCE(v.source, '') <> 'seed' AND NOT v.flagged AND v.created_at >= ${new Date(Date.now() - 7 * 86400_000).toISOString()}
      AND (u.id IS NULL OR (u.email IS NOT NULL AND u.banned_at IS NULL)) ${notAdmin}
      AND COALESCE(v.user_id, dv.user_id, v.device_id) IS NOT NULL
    GROUP BY 1 ORDER BY n DESC, who LIMIT ${Math.max(1, rank)}`);
  const r = watchedRank(top.length, rank);
  if (r == null) return { voters: 0, rank: 0, votes: 0, remaining: null as number | null };
  const who = top[r - 1]!;
  const [acct] = await db.execute<{ id: string }>(sql`SELECT id FROM "user" WHERE id = ${who.who}`);
  const userId = acct?.id ?? null;
  const devs = userId
    ? (await db.execute<{ id: string }>(sql`SELECT id FROM device WHERE user_id = ${userId}`)).map((d) => d.id)
    : [who.who];
  const mine = (t: string) =>
    sql`(${userId ? sql`${sql.raw(t)}.user_id = ${userId}` : sql`false`}${devs.length ? sql` OR ${sql.raw(t)}.device_id IN (${list(devs)})` : sql``})`;
  const [left] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM battle b JOIN "user" a ON a.id = b.author_id
    WHERE b.status = 'OPEN' AND b.deadline > now() AND b.created_at > ${new Date(Date.now() - 7 * 86400_000).toISOString()}
      AND b.visibility = 'PUBLIC' AND a.banned_at IS NULL ${userId ? sql`AND b.author_id <> ${userId}` : sql``}
      AND NOT EXISTS (SELECT 1 FROM vote v WHERE v.battle_id = b.id AND ${mine("v")})
      AND NOT EXISTS (SELECT 1 FROM skip s WHERE s.battle_id = b.id AND ${mine("s")})`);
  return { voters: top.length, rank: r, votes: who.n, remaining: Number(left?.n ?? 0) };
}

// ---------- writing ----------

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    battles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["text", "photo"] },
          voice: { type: "string", enum: ["F", "M", "N"] },
          topic: { type: "string" },
          title: { type: "string" },
          story: { type: "string" },
          a: { type: "string" },
          b: { type: "string" },
          aLine: { type: "string" },
          bLine: { type: "string" },
          pctA: { type: "integer" },
          queryA: { type: "string" },
          queryB: { type: "string" },
        },
        required: ["kind", "voice", "topic", "title", "story", "a", "b", "aLine", "bLine", "pctA", "queryA", "queryB"],
        additionalProperties: false,
      },
    },
  },
  required: ["battles"],
  additionalProperties: false,
} as const;

const SYSTEM = `You write posts for crowdpick, an app where real people post a two-option question and strangers vote.
Your posts are seed content: they must read exactly like real posts from real 18–35 year olds (mostly women) typing fast on their phone.

Voice and style (copy the examples closely):
- Casual first person, specific and a bit messy: real numbers, times, prices, ages, little petty details. Lowercase, "lol", "??", "ok" and run-ons are fine sometimes. Mild crude language is fine; no slurs, no explicit sex.
- title: the whole situation + the question, up to ${TITLE_MAX} characters. Me-vs-partner fights end with a varied "Who's right?" ("Ok who's right?", "Who's actually right here?").
- story: one or two short lines with a NEW detail that makes people pick a side. Never repeat or rephrase the title.
- a / b: short answers, 1–4 words ("Fair" / "Not fair", "Keep it" / "Send it back"). Me-vs-partner answers finish the question: "I'm right" / "He's right" (or "She's right").
- aLine / bLine: empty strings almost always. Only rarely a short first-person aside that shows the poster's lean; never a slogan, never "your…", never a repeat of the title.
- pctA: the share (3–97) you think would pick A. Make it believable, often lopsided.
- voice: F = a woman posting, M = a man posting, N = could be anyone. Mostly F, about 1 in 5 M.
- Never: emoji, em dashes, "not X, not Y" or "not just X, but Y" phrasing, therapy-speak, AI words (journey, navigate, delve), hashtags, real people's names (first names of partners are ok sparingly), celebrities as the subject, kids' names, anything about self-harm.
- Every post is a different situation. Don't reuse the examples' situations.

Photo posts (kind "photo"): the two options are things or places a real photo can show side by side: venues, rooms, houses, couches, cars, cakes, flowers, rings, dogs, cats, trips, gifts, decor. Never compare how a person looks (hair, makeup, outfits, tattoos, bodies, selfies), never photos of kids.
queryA / queryB: a plain 2–5 word photo search for what each option's photo shows ("rustic barn wedding venue", "grey sectional couch"). Text posts: empty strings.`;

type Example = { title: string; story: string | null; a: string; b: string; aLine: string | null; bLine: string | null; photo: boolean };

async function examples(): Promise<Example[]> {
  const rows = await db.execute<Example>(sql`
    SELECT b.title, b.context AS story, oa.label AS a, ob.label AS b, oa.description AS "aLine", ob.description AS "bLine",
      (oa.image_url IS NOT NULL) AS photo
    FROM battle b
    JOIN option oa ON oa.battle_id = b.id AND oa.side = 'A'
    JOIN option ob ON ob.battle_id = b.id AND ob.side = 'B'
    WHERE (b.id LIKE 'seed\\_launch%' OR b.id LIKE 'seed\\_b2\\_%' OR b.id LIKE 'seed\\_auto\\_%') AND b.status <> 'HIDDEN'
    ORDER BY random() LIMIT 30`);
  return rows;
}

async function writeDrafts(slots: { kind: SeedKind; topic: string }[], ex: Example[]): Promise<SeedDraft[]> {
  const brief = Object.fromEntries(TOPIC_MIX.map(([t, , b]) => [t, b]));
  const exText = ex
    .map((e) => `- ${e.photo ? "[photo] " : ""}title: ${e.title}\n  story: ${e.story ?? ""}\n  a: ${e.a}${e.aLine ? ` (line: ${e.aLine})` : ""} | b: ${e.b}${e.bLine ? ` (line: ${e.bLine})` : ""}`)
    .join("\n");
  const want = slots.map((s, i) => `${i + 1}. kind ${s.kind}, topic "${s.topic}" (${brief[s.topic] ?? s.topic})`).join("\n");
  const msg = await anthropic().messages.create({
    model: WRITER(),
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
    messages: [{ role: "user", content: `Real posts from the app, for voice:\n${exText}\n\nWrite ${slots.length} new posts, in this order:\n${want}` }],
  });
  const t = msg.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(t) as { battles?: SeedDraft[] };
    return (parsed.battles ?? []).map((d, i) => ({ ...d, kind: slots[i]?.kind ?? d.kind, topic: slots[i]?.topic ?? d.topic, aLine: d.aLine ?? "", bLine: d.bLine ?? "", story: d.story ?? "" }));
  } catch {
    return [];
  }
}

// ---------- photos ----------

type PexelsPhoto = { id: number; url: string; photographer: string; alt?: string; src: { original: string; medium: string } };

async function pexels(query: string, page: number): Promise<PexelsPhoto[]> {
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&page=${page}`, {
    headers: { Authorization: process.env.PEXELS_API_KEY! },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
  return ((await res.json()) as { photos?: PexelsPhoto[] }).photos ?? [];
}

const PICK_SCHEMA = {
  type: "object",
  properties: { fits: { type: "array", items: { type: "integer" } } },
  required: ["fits"],
  additionalProperties: false,
} as const;

/** Claude looks at the candidates and returns the ones (best first) that fit the option and the headline. */
async function judgePhotos(d: SeedDraft, side: "A" | "B", cands: PexelsPhoto[]): Promise<PexelsPhoto[]> {
  if (!cands.length) return [];
  const label = side === "A" ? d.a : d.b;
  const query = side === "A" ? d.queryA : d.queryB;
  const msg = await anthropic().messages.create({
    model: SMALL_MODEL,
    max_tokens: 1000,
    output_config: { effort: "low", format: { type: "json_schema", schema: PICK_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          ...cands.flatMap((c, i): Anthropic.ContentBlockParam[] => [
            { type: "text", text: `Photo ${i}:` },
            { type: "image", source: { type: "url", url: c.src.medium } },
          ]),
          {
            type: "text",
            text: `A voting app post: "${d.title}" ${d.story ? `(${d.story})` : ""}
Option ${side}: "${label}". Its photo should show: ${query}.
Which photos work for option ${side}? A photo works only if ALL are true:
- a real photograph (no illustration, 3D render, cartoon, emoji, collage, text overlay or watermark)
- it clearly shows "${label}" as described
- it matches every fact in the post (number of people, size, season, setting, indoor/outdoor, men/women)
- no children, no recognizable celebrity, no nudity, no brand logo as the main subject
Return the numbers of the photos that work, best first. Empty list if none.`,
          },
        ],
      },
    ],
  });
  const t = msg.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  try {
    const fits = (JSON.parse(t) as { fits?: number[] }).fits ?? [];
    return fits.map((i) => cands[i]).filter((c): c is PexelsPhoto => !!c);
  } catch {
    return [];
  }
}

const photoUrl = (p: PexelsPhoto) => `${p.src.original}?auto=compress&cs=tinysrgb&w=1080`;

/** Two fitting, unused Pexels photos for a photo draft, or null. Searches deep first (pages 2–4), then page 1. */
async function findPhotos(d: SeedDraft, used: Set<number>, rand: () => number): Promise<[PexelsPhoto, PexelsPhoto] | null> {
  const out: PexelsPhoto[] = [];
  for (const side of ["A", "B"] as const) {
    const query = (side === "A" ? d.queryA : d.queryB)!;
    let found: PexelsPhoto | undefined;
    for (const page of [2 + Math.floor(rand() * 3), 1]) {
      const cands = (await pexels(query, page)).filter((p) => !used.has(p.id) && !out.some((o) => o.id === p.id)).slice(0, 8);
      found = (await judgePhotos(d, side, cands))[0];
      if (found) break;
    }
    if (!found) return null;
    out.push(found);
  }
  for (const p of out) used.add(p.id);
  return [out[0]!, out[1]!];
}

// ---------- posting ----------

type Poster = { id: string; voice: Voice; posts: number; fresh: boolean };

async function loadPosters(): Promise<Poster[]> {
  const rows = await db.execute<{ id: string; labels: string[]; voices: (string | null)[]; recent: number }>(sql`
    SELECT u.id, array_agg(o.label) AS labels, array_agg(b.tags->'seed'->>'voice') AS voices,
      count(DISTINCT b.id) FILTER (WHERE b.created_at > now() - interval '3 days')::int AS recent
    FROM "user" u JOIN battle b ON b.author_id = u.id JOIN option o ON o.battle_id = b.id
    WHERE u.email IS NULL AND u.banned_at IS NULL AND u.handle IS NOT NULL AND u.handle NOT IN (${list(SPECIAL_HANDLES)})
      AND b.id LIKE 'seed\\_%' AND COALESCE((b.tags->>'pickbot')::boolean, false) = false
    GROUP BY u.id`);
  return rows.map((r) => {
    const tagged = r.voices.find((v) => v === "F" || v === "M") as Voice | undefined;
    return { id: r.id, voice: tagged ?? voiceFromLabels(r.labels), posts: Number(r.recent), fresh: false };
  });
}

async function loadVoters(): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT u.id FROM "user" u
    WHERE u.email IS NULL AND u.banned_at IS NULL AND u.handle IS NOT NULL AND u.handle NOT IN (${list(SPECIAL_HANDLES)})
      AND (EXISTS (SELECT 1 FROM vote v WHERE v.user_id = u.id AND v.source = 'seed') OR EXISTS (SELECT 1 FROM battle b WHERE b.author_id = u.id AND b.id LIKE 'seed\\_%'))`);
  return rows.map((r) => r.id);
}

async function newPoster(voice: Voice, rand: () => number): Promise<Poster> {
  for (let i = 0; i < 8; i++) {
    const handle = seedHandle(voice, rand);
    const id = `seed_au_${createId()}`;
    const daysAgo = 2 + Math.floor(rand() * 20);
    const rows = await db.execute<{ id: string }>(sql`
      INSERT INTO "user" (id, handle, name, is_adult_confirmed, onboarded_at, kid_ages, created_at)
      VALUES (${id}, ${handle}, ${handle}, true, now() - make_interval(days => ${daysAgo}), '{}', now() - make_interval(days => ${daysAgo}))
      ON CONFLICT DO NOTHING RETURNING id`);
    if (rows.length) return { id, voice, posts: 0, fresh: true };
  }
  throw new Error("couldn't make a unique handle");
}

function pickPoster(pool: Poster[], voice: Voice, rand: () => number): Poster | null {
  const ok = pool.filter((p) => p.posts < 2 && (voice === "N" ? p.voice !== "N" || rand() < 0.5 : p.voice === voice));
  return ok.length ? ok[Math.floor(rand() * ok.length)]! : null;
}

async function postSeed(o: {
  d: SeedDraft;
  batchId: string;
  author: string;
  photos: [PexelsPhoto, PexelsPhoto] | null;
  voters: string[];
  rand: () => number;
}) {
  const { d, rand } = o;
  const now = Date.now();
  const createdAt = Math.round(humanTime(now - 10 * 3600_000, now - 20 * 60_000, rand));
  const deadline = createdAt + (100 + Math.floor(rand() * 20)) * 3600_000;
  const id = `seed_auto_${createId()}`;
  const tags = {
    seed: {
      auto: o.batchId,
      voice: d.voice,
      topic: d.topic,
      kind: o.photos ? ("photo" as const) : ("text" as const),
      pctA: d.pctA,
      ...(o.photos ? { photos: o.photos.map((p) => ({ id: p.id, by: p.photographer, page: p.url })) } : {}),
    },
  };
  const others = o.voters.filter((v) => v !== o.author);
  const n = Math.min(others.length, 15 + Math.floor(rand() * 6));
  const chosen = [...others].sort(() => rand() - 0.5).slice(0, n);
  const plan = planVotes({ n, pctA: d.pctA, createdAt, now, words: (d.title + d.story).length, photo: !!o.photos, rand });
  const votesA = plan.filter((v) => v.side === "A").length;

  await db.transaction(async (tx) => {
    let slug = createSlug();
    for (let i = 0; i < 3; i++) {
      const [hit] = await tx.execute<{ id: string }>(sql`SELECT id FROM battle WHERE slug = ${slug}`);
      if (!hit) break;
      slug = createSlug();
    }
    await tx.execute(sql`
      INSERT INTO battle (id, slug, author_id, title, context, category_id, tags, created_at, updated_at, deadline, votes_a, votes_b)
      VALUES (${id}, ${slug}, ${o.author}, ${d.title.trim()}, ${d.story.trim() || null}, ${DEFAULT_CATEGORY_ID}, ${JSON.stringify(tags)}::jsonb,
        ${new Date(createdAt).toISOString()}, ${new Date(createdAt).toISOString()}, ${new Date(deadline).toISOString()}, ${votesA}, ${plan.length - votesA})`);
    const sides = [
      { side: "A", label: d.a.trim(), line: d.aLine.trim() || null, img: o.photos ? photoUrl(o.photos[0]) : null },
      { side: "B", label: d.b.trim(), line: d.bLine.trim() || null, img: o.photos ? photoUrl(o.photos[1]) : null },
    ];
    for (const s of sides)
      await tx.execute(sql`
        INSERT INTO option (id, battle_id, side, label, description, image_url)
        VALUES (${`${id}_${s.side.toLowerCase()}`}, ${id}, ${s.side}::side, ${s.label}, ${s.line}, ${s.img})`);
    for (let i = 0; i < plan.length; i++) {
      const v = plan[i]!;
      const voter = chosen[i]!;
      await tx.execute(sql`
        INSERT INTO vote (id, battle_id, user_id, device_id, side, dwell_ms, source, created_at)
        VALUES (${`sva_${md5(voter + id).slice(0, 20)}`}, ${id}, ${voter}, ${`seedvote_u_${md5(voter).slice(0, 12)}`}, ${v.side}::side, ${v.dwellMs}, 'seed', ${new Date(v.at).toISOString()})
        ON CONFLICT DO NOTHING`);
    }
  });
  return id;
}

// ---------- the run ----------

async function existingTitles(): Promise<string[]> {
  return (await db.execute<{ title: string }>(sql`SELECT title FROM battle`)).map((r) => r.title);
}

async function usedPexelsIds(): Promise<Set<number>> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT substring(image_url from 'pexels\\.com/photos/([0-9]+)/') AS id FROM option WHERE image_url LIKE '%pexels.com/photos/%'`);
  return new Set(rows.map((r) => Number(r.id)).filter((n) => n > 0));
}

export type AutoSeedResult = { check: SeedState["lastCheck"]; wrote: number; photos: number; batch: SeedState["batch"]; note: string };

/**
 * Hourly. `force` (admin button) starts a batch now, ignoring the threshold and the cooldown (still needs the
 * Claude key). Writes for at most `budgetMs`, then saves progress; the next run continues the batch.
 */
export async function runAutoSeed(opts: { force?: boolean; budgetMs?: number } = {}): Promise<AutoSeedResult> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 200_000;
  const e = await getEconomy();
  let state = await readState();
  const now = new Date();

  const c = await deckCheck(e.autoSeedRank);
  const continuing = !!state.batch && state.batch.made < state.batch.target && now.getTime() - new Date(state.batch.startedAt).getTime() < 48 * 3600_000;
  const decision = continuing
    ? { start: false, note: `Continuing batch ${state.batch!.id} (${state.batch!.made}/${state.batch!.target}).` }
    : opts.force
      ? { start: true, note: "Started by an admin." }
      : shouldStartBatch({ enabled: e.autoSeed > 0, remaining: c.remaining, threshold: e.autoSeedAt, lastFinishedAt: state.lastFinishedAt, cooldownHours: e.autoSeedCooldownHours, now });
  state.lastCheck = { at: now.toISOString(), voters: c.voters, rank: c.rank, remaining: c.remaining, fired: decision.start, note: decision.note };
  if (!continuing && state.batch && state.batch.made < state.batch.target) state.batch = null; // stale (48h+)
  if ((!continuing && !decision.start) || (continuing && e.autoSeed <= 0 && !opts.force)) {
    await saveState({ ...(await readState()), lastCheck: state.lastCheck });
    return { check: state.lastCheck, wrote: 0, photos: 0, batch: state.batch, note: decision.note };
  }
  if (!writerConfigured()) {
    const note = "Needs ANTHROPIC_API_KEY to write battles.";
    await saveState({ ...(await readState()), lastCheck: state.lastCheck, lastError: note });
    return { check: state.lastCheck, wrote: 0, photos: 0, batch: state.batch, note };
  }
  if (!(await claim(new Date(started + budget + 60_000)))) {
    return { check: state.lastCheck, wrote: 0, photos: 0, batch: state.batch, note: "Another run is writing right now." };
  }
  const lastCheck = state.lastCheck;
  state = await readState();
  state.lastCheck = lastCheck;
  if (!continuing) {
    const target = Math.max(1, e.autoSeedCount);
    state.batch = {
      id: `a${now.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`,
      startedAt: now.toISOString(),
      target,
      photoTarget: photosConfigured() ? photoCount(target, e.autoSeedPhotoPct) : 0,
      made: 0,
      photos: 0,
      photoFails: 0,
      reason: decision.note,
    };
  }
  const batch = state.batch!;
  let wrote = 0;
  let wrotePhotos = 0;
  state.lastError = null;
  try {
    const rand = Math.random;
    const [titles, used, posters, voters] = await Promise.all([existingTitles(), usedPexelsIds(), loadPosters(), loadVoters()]);
    const batchPosters: Poster[] = [];
    let ex = await examples();
    let rounds = 0;
    while (batch.made < batch.target && Date.now() - started < budget - 45_000 && rounds++ < 12) {
      if (!photosConfigured() || batch.photoFails > 30) batch.photoTarget = batch.photos;
      const needPhoto = Math.max(0, batch.photoTarget - batch.photos);
      const needText = Math.max(0, batch.target - batch.photoTarget - (batch.made - batch.photos));
      const n = Math.min(CHUNK * PARALLEL, needPhoto + needText);
      if (n <= 0) break;
      const nPhoto = Math.round((n * needPhoto) / (needPhoto + needText));
      const topics = topicPlan(n).sort(() => rand() - 0.5);
      const slots = topics.map((topic, i) => ({ kind: (i < nPhoto ? "photo" : "text") as SeedKind, topic })).sort(() => rand() - 0.5);
      const chunks: (typeof slots)[] = [];
      for (let i = 0; i < slots.length; i += CHUNK) chunks.push(slots.slice(i, i + CHUNK));
      const drafts = (await Promise.all(chunks.map((s) => writeDrafts(s, ex).catch((err) => (console.error("[auto-seed] write", err), [] as SeedDraft[]))))).flat();
      let okPhoto = needPhoto;
      let okText = needText;
      const good = drafts.filter((d) => {
        if (draftProblems(d, isAbusive).length || isDuplicate(d.title, titles)) return false;
        if (d.kind === "photo" ? okPhoto <= 0 : okText <= 0) return false;
        titles.push(d.title);
        if (d.kind === "photo") okPhoto--;
        else okText--;
        return true;
      });
      // Photos: a few at a time.
      const withPhotos = new Map<SeedDraft, [PexelsPhoto, PexelsPhoto]>();
      const photoDrafts = good.filter((d) => d.kind === "photo");
      for (let i = 0; i < photoDrafts.length; i += 5) {
        await Promise.all(
          photoDrafts.slice(i, i + 5).map(async (d) => {
            const p = await findPhotos(d, used, rand).catch((err) => (console.error("[auto-seed] photo", err), null));
            if (p) withPhotos.set(d, p);
            else batch.photoFails++;
          }),
        );
      }
      for (const d of good) {
        if (batch.made >= batch.target) break;
        if (d.kind === "photo" && !withPhotos.has(d)) continue;
        const existing = rand() < 0.35 ? pickPoster(posters, d.voice, rand) : null;
        const again = !existing && rand() < 0.25 ? pickPoster(batchPosters, d.voice, rand) : null;
        const poster = existing ?? again ?? (await newPoster(d.voice === "N" ? (rand() < 0.8 ? "F" : "M") : d.voice, rand));
        if (poster.fresh && !batchPosters.includes(poster)) batchPosters.push(poster);
        poster.posts++;
        await postSeed({ d, batchId: batch.id, author: poster.id, photos: withPhotos.get(d) ?? null, voters, rand });
        batch.made++;
        wrote++;
        if (d.kind === "photo") {
          batch.photos++;
          wrotePhotos++;
        }
      }
      await saveState({ ...state, batch, runningUntil: new Date(started + budget + 60_000).toISOString() });
      if (rounds % 3 === 0) ex = await examples();
    }
  } catch (err) {
    console.error("[auto-seed]", err);
    state.lastError = String(err instanceof Error ? err.message : err).slice(0, 300);
  }
  if (batch.made >= batch.target) {
    state.lastFinishedAt = new Date().toISOString();
    state.history = [{ id: batch.id, at: state.lastFinishedAt, made: batch.made, photos: batch.photos, reason: batch.reason }, ...state.history].slice(0, 20);
    state.batch = null;
  } else state.batch = batch;
  await saveState({ ...state, runningUntil: null });
  return { check: state.lastCheck, wrote, photos: wrotePhotos, batch: state.batch, note: decision.note };
}

/** For /admin/battles: settings, keys, last check, the batch in progress and past batches. */
export async function autoSeedStatus() {
  const [e, state] = await Promise.all([getEconomy(), readState()]);
  const [counts] = await db.execute<{ auto: number; open_auto: number }>(sql`
    SELECT count(*)::int AS auto, count(*) FILTER (WHERE status = 'OPEN' AND deadline > now())::int AS open_auto FROM battle WHERE id LIKE 'seed\\_auto\\_%'`);
  return {
    on: e.autoSeed > 0,
    rank: e.autoSeedRank,
    at: e.autoSeedAt,
    count: e.autoSeedCount,
    photoPct: e.autoSeedPhotoPct,
    cooldownHours: e.autoSeedCooldownHours,
    writer: writerConfigured(),
    photos: photosConfigured(),
    totalAuto: Number(counts?.auto ?? 0),
    openAuto: Number(counts?.open_auto ?? 0),
    state,
  };
}
