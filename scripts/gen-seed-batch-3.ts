/**
 * Writes drizzle/0046_seed_batch_3.sql (Alex, Nov 27 2026): 60 seed battles on what people are worried about:
 * money and affordability, jobs and layoffs (AI too), the economy, and political differences in families.
 *   - 42 text + 18 photo (30%). Photos are free Pexels photos of things and places only, each checked against its
 *     headline; ids not used by any earlier seed.
 *   - Posted ~60% by existing seed posters (voice matched, one post each in this batch), the rest by new believable
 *     sign-ups `seed_b3u_*` (`seedHandle()`).
 *   - 15–20 votes per battle from seed accounts (never the poster), human hours and dwell times (`planVotes()`).
 *     Votes are source 'seed' from email-less accounts on seed_ battles, so the Brain's Clean view and the Journey
 *     ignore them; they show in "All data (AI view)" only.
 * Undo: DELETE FROM vote WHERE id LIKE 'sv3\_%'; DELETE FROM option WHERE battle_id LIKE 'seed\_b3\_%';
 *       DELETE FROM battle WHERE id LIKE 'seed\_b3\_%'; DELETE FROM "user" WHERE id LIKE 'seed\_b3u\_%';
 *
 *   npx tsx scripts/gen-seed-batch-3.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbusive } from "../src/server/moderation";
import { draftProblems, mulberry32, planVotes, seedHandle, type SeedDraft, type Voice } from "../src/lib/auto-seed";

type Row = { voice: Voice; topic: string; title: string; story: string; a: string; b: string; pctA: number; imgA?: string; imgB?: string };
type Poster = { id: string; handle: string; posts: number; g: "F" | "M" | "?"; cat: string };

const DIR = "scripts/seed-batch-3";
const data = JSON.parse(readFileSync(`${DIR}/batch3.data.json`, "utf8")) as { text: Row[]; photo: Row[] };
const posters = JSON.parse(readFileSync("scripts/seed-batch-2/existing_posters.json", "utf8")) as Poster[];
const rand = mulberry32(20261127);
const h = (s: string, n = 16) => createHash("md5").update(s).digest("hex").slice(0, n);
const q = (s: string | null | undefined) => (s == null || s === "" ? "NULL" : `'${s.replace(/'/g, "''")}'`);
const pexels = (id: string) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1080`;

type B = Row & { id: string; kind: "text" | "photo"; author?: string; createdMin?: number; deadlineH?: number };
const battles: B[] = [
  ...data.text.map((x, i): B => ({ ...x, id: `seed_b3_t${i + 1}`, kind: "text" })),
  ...data.photo.map((x, i): B => ({ ...x, id: `seed_b3_p${i + 1}`, kind: "photo" })),
];

// Same checks as the auto-seed writer, plus no reused photos.
const usedIds = new Set(readdirSync("drizzle").filter((f) => f.endsWith(".sql") && !f.startsWith("0046")).flatMap((f) => readFileSync(`drizzle/${f}`, "utf8").match(/pexels-photo-\d+/g) ?? []));
const seenImg = new Set<string>();
for (const b of battles) {
  const d: SeedDraft = { kind: b.kind, voice: b.voice, topic: b.topic, title: b.title, story: b.story, a: b.a, b: b.b, aLine: "", bLine: "", pctA: b.pctA, queryA: b.imgA, queryB: b.imgB };
  const problems = draftProblems(d, isAbusive);
  if (problems.length) throw new Error(`${b.id}: ${problems.join(", ")} (${b.title})`);
  for (const img of [b.imgA, b.imgB].filter(Boolean) as string[]) {
    if (usedIds.has(`pexels-photo-${img}`) || seenImg.has(img)) throw new Error(`${b.id}: photo ${img} already used`);
    seenImg.add(img);
  }
}
if (battles.length !== 60) throw new Error(`expected 60 battles, got ${battles.length}`);

// ── Posters ─────────────────────────────────────────────────────────────────────────────────────────
const newUsers: Poster[] = [];
const usedHandles = new Set(posters.map((p) => p.handle));
const taken = new Set<string>();
for (const b of [...battles].sort(() => rand() - 0.5)) {
  const g = b.voice === "M" ? "M" : b.voice === "F" ? "F" : rand() < 0.75 ? "F" : "M";
  const pool = posters.filter((p) => p.g === g && !taken.has(p.id));
  if (rand() < 0.6 && pool.length) {
    const p = pool[Math.floor(rand() * pool.length)]!;
    taken.add(p.id);
    b.author = p.id;
  } else {
    let handle = seedHandle(g as Voice, rand);
    while (usedHandles.has(handle)) handle = seedHandle(g as Voice, rand);
    usedHandles.add(handle);
    const u: Poster = { id: `seed_b3u_${newUsers.length + 1}`, handle, posts: 1, g, cat: b.topic };
    newUsers.push(u);
    b.author = u.id;
  }
}

// ── Timing (minutes before the migration runs) ────────────────────────────────────────────────────
const NOW = Date.now();
const HOURLY = [1.2, 0.7, 0.35, 0.2, 0.15, 0.2, 0.45, 0.9, 1.1, 1.0, 1.0, 1.1, 1.5, 1.4, 1.0, 1.0, 1.1, 1.3, 1.5, 1.8, 2.0, 2.1, 1.9, 1.6];
const etHour = (minAgo: number) => (new Date(NOW - minAgo * 60000).getUTCHours() + 19) % 24;
for (const b of battles) {
  for (;;) {
    const m = 40 + rand() * (60 * 60 - 40);
    if (rand() * 2.1 < HOURLY[etHour(m)]!) { b.createdMin = Math.round(m); break; }
  }
  b.deadlineH = 100 + Math.floor(rand() * 20); // ≤ 5 days from posting
}

// ── Votes ───────────────────────────────────────────────────────────────────────────────────────────
const voterIds = [...posters.map((p) => p.id), ...Array.from({ length: 36 }, (_, i) => `seed_b2u_${i + 1}`), ...newUsers.map((u) => u.id)];
const votes: { id: string; battle: string; user: string; side: "A" | "B"; dwell: number; sec: number }[] = [];
for (const b of battles) {
  const n = 15 + Math.floor(rand() * 6);
  const created = NOW - b.createdMin! * 60000;
  const plan = planVotes({ n, pctA: b.pctA, createdAt: created, now: NOW, words: (b.title + b.story).split(/\s+/).length, photo: b.kind === "photo", rand });
  const chosen = new Set<string>([b.author!]);
  for (const v of plan) {
    let u: string;
    do u = voterIds[Math.floor(rand() * voterIds.length)]!;
    while (chosen.has(u));
    chosen.add(u);
    votes.push({ id: `sv3_${h(u + b.id, 20)}`, battle: b.id, user: u, side: v.side, dwell: v.dwellMs, sec: Math.max(30, Math.round((NOW - v.at) / 1000)) });
  }
}

// ── SQL ─────────────────────────────────────────────────────────────────────────────────────────────
const slug = (id: string) => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; const hx = h(id + "slug", 32); let s = ""; for (let i = 0; i < 8; i++) s += A[parseInt(hx.slice(i * 2, i * 2 + 2), 16) % A.length]; return s; };
const userRows = newUsers.map((u) => `  (${q(u.id)}, ${q(u.handle)}, ${q(u.handle)}, true, now() - interval '${3 + Math.floor(rand() * 20)} days', '{}', now() - interval '${3 + Math.floor(rand() * 20)} days')`);
const battleRows = battles.map((b) => `  (${q(b.id)}, ${q(slug(b.id))}, ${q(b.author)}, ${q(b.title)}, ${q(b.story)}, ${q(JSON.stringify({ seed: { batch: "b3", topic: b.topic, voice: b.voice } }))}, now() - interval '${b.createdMin} minutes', now() - interval '${b.createdMin} minutes' + interval '${b.deadlineH} hours')`);
const optionRows = battles.flatMap((b) => (["A", "B"] as const).map((side) => {
  const img = side === "A" ? b.imgA : b.imgB;
  return `  (${q(`${b.id}_${side.toLowerCase()}`)}, ${q(b.id)}, '${side}', ${q(side === "A" ? b.a : b.b)}, ${img ? q(pexels(img)) : "NULL"})`;
}));
const voteRows = votes.map((v) => `  (${q(v.id)}, ${q(v.battle)}, ${q(v.user)}, ${q(`seedvote_u_${h(v.user, 12)}`)}, '${v.side}', ${v.dwell}, ${v.sec})`);

const sql = `-- Seed batch 3 (Alex, Nov 27 2026): 60 battles on money, jobs, the economy and family politics; 42 text + 18 photo.
-- Generated by scripts/gen-seed-batch-3.ts from scripts/seed-batch-3/batch3.data.json. Idempotent.
-- Fake votes: source 'seed', email-less seed accounts → Brain "All data (AI view)" only, never Clean or Journey.
-- Undo: see the header of scripts/gen-seed-batch-3.ts.
INSERT INTO "user" ("id", "handle", "name", "is_adult_confirmed", "onboarded_at", "kid_ages", "created_at") VALUES
${userRows.join(",\n")}
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "battle" ("id", "slug", "author_id", "title", "context", "category_id", "tags", "created_at", "deadline")
SELECT v.id, v.slug, v.author, v.title, v.context, 'other', v.tags::jsonb, v.created_at, v.deadline FROM (VALUES
${battleRows.join(",\n")}
) AS v(id, slug, author, title, context, tags, created_at, deadline)
WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = v.author)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "option" ("id", "battle_id", "side", "label", "image_url")
SELECT v.id, v.battle_id, v.side::side, v.label, v.image_url FROM (VALUES
${optionRows.join(",\n")}
) AS v(id, battle_id, side, label, image_url)
WHERE EXISTS (SELECT 1 FROM "battle" b WHERE b.id = v.battle_id)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "vote" ("id", "battle_id", "user_id", "device_id", "side", "dwell_ms", "source", "created_at")
SELECT v.id, v.battle_id, v.user_id, v.device_id, v.side::side, v.dwell, 'seed', now() - make_interval(secs => v.sec)
FROM (VALUES
${voteRows.join(",\n")}
) AS v(id, battle_id, user_id, device_id, side, dwell, sec)
WHERE EXISTS (SELECT 1 FROM "battle" b WHERE b.id = v.battle_id)
  AND EXISTS (SELECT 1 FROM "user" u WHERE u.id = v.user_id)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "battle" b SET
  "votes_a" = (SELECT count(*) FROM "vote" v WHERE v.battle_id = b.id AND v.side = 'A'),
  "votes_b" = (SELECT count(*) FROM "vote" v WHERE v.battle_id = b.id AND v.side = 'B')
WHERE b.id LIKE 'seed\\_b3\\_%';
`;
writeFileSync("drizzle/0046_seed_batch_3.sql", sql);
writeFileSync(`${DIR}/batch3.preview.json`, JSON.stringify(battles.map((b) => ({
  id: b.id, kind: b.kind, topic: b.topic, title: b.title, story: b.story, a: b.a, b: b.b, imgA: b.imgA, imgB: b.imgB,
  author: [...posters, ...newUsers].find((p) => p.id === b.author)!.handle, votes: votes.filter((v) => v.battle === b.id).length,
  votesA: votes.filter((v) => v.battle === b.id && v.side === "A").length,
})), null, 1));
console.log(`${battles.length} battles, ${newUsers.length} new posters (${newUsers.map((u) => u.handle).join(", ")}), ${votes.length} votes`);
