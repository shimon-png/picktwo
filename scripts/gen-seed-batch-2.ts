/**
 * Writes drizzle/0032_seed_batch_2.sql (Alex, Nov 24 2026): 250 more seed battles.
 *   - 150 text battles, 50 photo battles (free Pexels photos, picked deep in the results and checked against
 *     each headline), 50 Airbnb battles (each option links to a real live Airbnb listing via option.url; the
 *     photo is a matching Pexels stand-in, never Airbnb's own photos).
 *   - Posted mostly by existing seed posters (gender + topic matched, at most 2 new posts each), the rest by
 *     ~36 new believable sign-ups.
 *   - Every new battle gets 15–20 votes from seed users (never its poster), cast in short sessions at human
 *     hours with human dwell times, sides drawn from a planned split plus each user's own lean.
 *     Every email-less (seed) user ends up with at least 15 seed votes; the SQL tops up anyone short
 *     (including accounts that only exist in prod) on other open seed battles.
 *   - Renames leftover demo_* accounts ("demo_dan" is obviously fake, Alex Nov 23) to name + 4 digits.
 *
 * Fake votes are source = 'seed' from email-less accounts on seed_ battles, so the Brain's Clean view and the
 * Journey funnel ignore them; they show in "All data (AI view)" only.
 * Undo: DELETE FROM vote WHERE id LIKE 'sv2\_%'; DELETE FROM option WHERE battle_id LIKE 'seed_b2_%';
 *       DELETE FROM battle WHERE id LIKE 'seed_b2_%'; DELETE FROM "user" WHERE id LIKE 'seed_b2u_%'; then recount.
 *
 *   npx tsx scripts/gen-seed-batch-2.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbusive } from "../src/server/moderation";
import { TITLE_MAX } from "../src/lib/constants";

type Text = { voice: string; title: string; story: string; a: string; aLine: string; b: string; bLine: string; pctA: number };
type Photo = { voice: string; title: string; story: string; a: string; b: string; pctA: number; imgA: string; imgB: string };
type Air = Text & { urlA: string; urlB: string; imgA: string; imgB: string };
type Poster = { id: string; handle: string; posts: number; g: "F" | "M" | "?"; cat: string };

const DIR = "scripts/seed-batch-2";
const data = JSON.parse(readFileSync(`${DIR}/batch2.data.json`, "utf8")) as { text: Text[]; photo: Photo[]; airbnb: Air[] };
const posters = JSON.parse(readFileSync(`${DIR}/existing_posters.json`, "utf8")) as Poster[];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261124);
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
const h = (s: string, n = 16) => createHash("md5").update(s).digest("hex").slice(0, n);
const q = (s: string | null | undefined) => (s == null || s === "" ? "NULL" : `'${s.replace(/'/g, "''")}'`);
const pexels = (id: string) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1080`;

// ── Battles ────────────────────────────────────────────────────────────────────────────────────────────
type B = {
  id: string; kind: "text" | "photo" | "airbnb"; voice: string; cat: string; title: string; story: string; pctA: number;
  opts: { label: string; line: string | null; img: string | null; url: string | null }[];
  author?: string; createdMin?: number; deadlineH?: number; votes?: number;
};

// Text sections in batch2.data.json order (see text.py headers).
const TEXT_CATS: [number, string][] = [[27, "couples"], [25, "cheating"], [22, "dating"], [24, "wedding"], [13, "parenting"], [20, "money"], [12, "life"], [5, "couples"], [2, "dating"]];
const textCat = (i: number) => { let n = 0; for (const [len, c] of TEXT_CATS) { n += len; if (i < n) return c; } return "life"; };
const guessCat = (t: string) =>
  /wedding|bride|bridal|bridesmaid|bachelor|honeymoon|ring|propos|engage|tux|bouquet/i.test(t) ? "wedding"
  : /baby|nursery|kid|toddler|17 year old|babymoon|family of|reunion|spring break/i.test(t) ? "parenting"
  : /date|match|hinge|bumble/i.test(t) ? "dating"
  : /he wants|who's right|anniversary|husband|bf|boyfriend/i.test(t) ? "couples"
  : "life";

const battles: B[] = [
  ...data.text.map((x, i): B => ({ id: `seed_b2_t${i + 1}`, kind: "text", voice: x.voice, cat: textCat(i), title: x.title, story: x.story, pctA: x.pctA,
    opts: [{ label: x.a, line: x.aLine || null, img: null, url: null }, { label: x.b, line: x.bLine || null, img: null, url: null }] })),
  ...data.photo.map((x, i): B => ({ id: `seed_b2_p${i + 1}`, kind: "photo", voice: x.voice, cat: guessCat(x.title), title: x.title, story: x.story, pctA: x.pctA,
    opts: [{ label: x.a, line: null, img: pexels(x.imgA), url: null }, { label: x.b, line: null, img: pexels(x.imgB), url: null }] })),
  ...data.airbnb.map((x, i): B => ({ id: `seed_b2_a${i + 1}`, kind: "airbnb", voice: x.voice, cat: guessCat(x.title), title: x.title, story: x.story, pctA: x.pctA,
    opts: [{ label: x.a, line: x.aLine || null, img: pexels(x.imgA), url: x.urlA }, { label: x.b, line: x.bLine || null, img: pexels(x.imgB), url: x.urlB }] })),
];

for (const b of battles) {
  if (b.title.length > TITLE_MAX) throw new Error(`title too long: ${b.title}`);
  for (const t of [b.title, b.story, ...b.opts.flatMap((o) => [o.label, o.line])]) if (isAbusive(t)) throw new Error(`profanity filter: ${t} (${b.id})`);
  for (const o of b.opts) { if (o.label.length > 60) throw new Error(`label: ${o.label}`); if ((o.line ?? "").length > 140) throw new Error(`line: ${o.line}`); }
}
if (battles.length !== 250) throw new Error(`expected 250 battles, got ${battles.length}`);

// ── New posters (believable sign-ups; ~3 in 4 use the suggested "email name + 4 digits" handle) ─────────
const F_NAMES = ["kaylee", "brooke", "jenna", "kelsey", "mackenzie", "haley", "shelby", "carly", "amber", "lindsey", "bailey", "kendra", "tessa",
  "jillian", "marissa", "alana", "bianca", "gianna", "noelle", "renee", "whitney", "kara", "delaney", "aubrey", "savannah", "harper", "lexi", "brynn",
  "dana", "callie", "rosa", "yesenia", "imani", "keisha", "anjali", "mei", "trinity", "erica"];
const M_NAMES = ["derek", "travis", "cody", "garrett", "brett", "shane", "colton", "trevor", "dustin", "mario", "jamal", "devin", "wes", "zach"];
const LAST = ["miller", "harris", "thompson", "martin", "clark", "lewis", "robinson", "hughes", "foster", "price", "sanders", "ross", "henderson",
  "coleman", "jenkins", "perry", "powell", "long", "flores", "ramirez", "torres", "diaz", "morales", "ortiz", "gray", "ward", "brooks", "kelly", "howard", "shah"];
const SELF = ["lakeday", "porchswing", "latte", "tacotuesday", "beachbum", "bookclub", "thrifted", "nightshift", "gymrat", "sunsetchaser", "ranchwater",
  "boymom", "girlmom", "teachertired", "cowboyboots", "matcha", "dogmom", "overpacked", "planner", "spicymargs"];
const MSELF = ["golfdad", "grillmaster", "dadjokes", "liftandlurk", "fishing", "garagebeers", "fantasyfootball"];
const usedHandles = new Set(posters.map((p) => p.handle));
function newHandle(g: "F" | "M") {
  for (;;) {
    const f = pick(g === "F" ? F_NAMES : M_NAMES);
    const l = pick(LAST);
    const r = rand();
    let hd: string;
    if (r < 0.75) {
      const s = rand();
      const name = (s < 0.4 ? f : s < 0.6 ? f[0] + l : s < 0.75 ? f + l[0] : s < 0.88 ? f + l : f.slice(0, 2) + l.slice(0, 4)).slice(0, 10);
      hd = `${name}${1000 + Math.floor(rand() * 9000)}`;
    } else {
      const w = pick(g === "F" ? SELF : MSELF);
      hd = rand() < 0.5 ? `${w}_${f.slice(0, rand() < 0.5 ? 4 : 10)}` : `${w}_${f}${10 + Math.floor(rand() * 89)}`;
    }
    if (!usedHandles.has(hd)) { usedHandles.add(hd); return hd; }
  }
}
const NEW_F = 29, NEW_M = 7;
const newUsers: Poster[] = [];
for (let i = 0; i < NEW_F + NEW_M; i++) {
  const g = i < NEW_F ? "F" : "M";
  newUsers.push({ id: `seed_b2u_${i + 1}`, handle: newHandle(g), posts: 0, g, cat: "" });
}

// ── Assign posters: ~70% existing (≤2 each in this batch), the rest new (1–3 each) ─────────────────────
const order = battles.map((_, i) => i).sort(() => rand() - 0.5);
const batchPosts = new Map<string, number>();
const voiceOk = (p: Poster, v: string) => (v === "N" ? true : p.g === v || (p.g === "?" && v === "F" && rand() < 0.3));
let existingCount = 0;
for (const i of order) {
  const b = battles[i]!;
  const useNew = rand() < 0.3 || (b.voice === "M" && rand() < 0.2);
  const pool = (useNew ? newUsers : posters).filter((p) => voiceOk(p, b.voice) && (batchPosts.get(p.id) ?? 0) < (useNew ? 3 : 2));
  if (!pool.length) throw new Error(`no poster for ${b.id}`);
  const w = pool.map((p) => (p.cat === b.cat ? 4 : 1) / (1 + (batchPosts.get(p.id) ?? 0) * 2) / (useNew ? 1 : Math.sqrt(1 + p.posts)));
  let r = rand() * w.reduce((a, c) => a + c, 0), k = 0;
  while ((r -= w[k]!) > 0) k++;
  b.author = pool[k]!.id;
  batchPosts.set(b.author, (batchPosts.get(b.author) ?? 0) + 1);
  if (!useNew) existingCount++;
}
const unusedNew = newUsers.filter((u) => !batchPosts.get(u.id));
// Give anyone new who didn't post one battle from an existing poster with 2.
for (const u of unusedNew) {
  const b = battles.find((x) => x.author && !x.author.startsWith("seed_b2u_") && (batchPosts.get(x.author) ?? 0) === 2 && voiceOk(u, x.voice) && x.voice !== "N")!;
  if (!b) continue;
  batchPosts.set(b.author!, 1); b.author = u.id; batchPosts.set(u.id, 1); existingCount--;
}

// ── Timing (minutes before the migration runs). Assumes it runs within a few hours of generation. ──────────
const NOW = Date.now();
const etHour = (minAgo: number) => (new Date(NOW - minAgo * 60000).getUTCHours() + 24 - 5) % 24;
// Relative activity by ET hour (people vote at lunch and in the evening, barely at 3am).
const HOURLY = [1.2, 0.7, 0.35, 0.2, 0.15, 0.2, 0.45, 0.9, 1.1, 1.0, 1.0, 1.1, 1.5, 1.4, 1.0, 1.0, 1.1, 1.3, 1.5, 1.8, 2.0, 2.1, 1.9, 1.6];
function humanTime(minMin: number, maxMin: number) {
  for (;;) {
    const m = minMin + rand() * (maxMin - minMin);
    if (rand() * 2.1 < HOURLY[etHour(m)]!) return m;
  }
}
for (const b of battles) {
  b.createdMin = Math.round(humanTime(40, 62 * 60));
  b.deadlineH = 100 + Math.floor(rand() * 20); // ≤ 5 days from posting
}

// ── Voters ───────────────────────────────────────────────────────────────────────────────────────────
const voters = [...posters, ...newUsers].map((p) => ({ id: p.id, lean: gauss() * 0.07, speed: Math.exp(gauss() * 0.35),
  total: 15 + Math.min(70, Math.floor(Math.exp(1.5 + gauss() * 0.9))), quota: 0, votes: [] as { b: B; side: "A" | "B"; dwell: number; sec: number }[] }));
const heat: Record<string, number> = { couples: 1.25, cheating: 1.3, wedding: 1.1, dating: 1.1, money: 1.0, parenting: 0.95, life: 0.9 };
for (const b of battles) b.votes = Math.min(20, Math.max(15, Math.round(15 + rand() * 3.5 + (heat[b.cat] ?? 1) * 1.6 - 1.2 + gauss() * 0.8)));
const T = battles.reduce((s, b) => s + b.votes!, 0);
const totalWanted = voters.reduce((s, v) => s + v.total, 0);
for (const v of voters) v.quota = Math.max(1, Math.round((v.total * T) / totalWanted));

for (const b of [...battles].sort((x, y) => y.createdMin! - x.createdMin!)) {
  const chosen = new Set<string>();
  while (chosen.size < b.votes!) {
    const pool = voters.filter((v) => v.id !== b.author && !chosen.has(v.id));
    const w = pool.map((v) => Math.max(0.05, v.quota - v.votes.length));
    let r = rand() * w.reduce((a, c) => a + c, 0), k = 0;
    while ((r -= w[k]!) > 0) k++;
    const v = pool[k]!;
    chosen.add(v.id);
    const pA = Math.min(0.97, Math.max(0.03, b.pctA / 100 + v.lean));
    const words = (b.title + b.story).length;
    const base = b.kind === "text" ? 2600 + words * 28 : 2400 + words * 14;
    const dwell = Math.round(Math.min(25000, Math.max(1100, base * v.speed * Math.exp(gauss() * 0.35))));
    v.votes.push({ b, side: rand() < pA ? "A" : "B", dwell, sec: 0 });
  }
}

// Sessions: each voter opens the app a few times; a vote lands in a session after the battle was posted.
for (const v of voters) {
  const nS = Math.max(1, Math.min(6, Math.round(v.votes.length / (6 + rand() * 8))));
  const sessions = Array.from({ length: nS }, () => humanTime(6, 61 * 60));
  const bySession = new Map<number, typeof v.votes>();
  for (const vote of v.votes) {
    const ok = sessions.filter((s) => s < vote.b.createdMin! - 4);
    let s = ok.length ? pick(ok) : NaN;
    if (Number.isNaN(s)) { s = humanTime(6, vote.b.createdMin! - 5); sessions.push(s); }
    if (!bySession.has(s)) bySession.set(s, []);
    bySession.get(s)!.push(vote);
  }
  for (const [s, vs] of bySession) {
    let sec = s * 60; // seconds ago at session start
    vs.sort(() => rand() - 0.5);
    for (const vote of vs) {
      sec -= vote.dwell / 1000 + 1.5 + rand() * 6;
      vote.sec = Math.max(20, Math.round(sec));
    }
  }
}

// ── SQL ──────────────────────────────────────────────────────────────────────────────────────────────
const slug = (id: string) => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; const hx = h(id + "slug", 32); let s = ""; for (let i = 0; i < 8; i++) s += A[parseInt(hx.slice(i * 2, i * 2 + 2), 16) % A.length]; return s; };
const userRows = newUsers.map((u) => `  (${q(u.id)}, ${q(u.handle)}, ${q(u.handle)}, true, now() - interval '${3 + Math.floor(rand() * 20)} days', '{}', now() - interval '${3 + Math.floor(rand() * 20)} days')`);
const battleRows = battles.map((b) => `  (${q(b.id)}, ${q(slug(b.id))}, ${q(b.author)}, ${q(b.title)}, ${q(b.story)}, now() - interval '${b.createdMin} minutes', now() - interval '${b.createdMin} minutes' + interval '${b.deadlineH} hours')`);
const optionRows = battles.flatMap((b) => b.opts.map((o, i) => {
  const side = i === 0 ? "A" : "B";
  return `  (${q(`${b.id}_${side.toLowerCase()}`)}, ${q(b.id)}, '${side}', ${q(o.label)}, ${q(o.line)}, ${q(o.img)}, ${q(o.url)}, ${o.url ? "'Airbnb'" : "NULL"})`;
}));
const voteRows = voters.flatMap((v) => v.votes.map((x) => `  (${q(`sv2_${h(v.id + x.b.id, 20)}`)}, ${q(x.b.id)}, ${q(v.id)}, ${q(`seedvote_u_${h(v.id, 12)}`)}, '${x.side}', ${x.dwell}, ${x.sec})`));
const targetRows = voters.map((v) => `  (${q(v.id)}, ${v.total})`);

const sql = `-- Seed batch 2 (Alex, Nov 24 2026): 150 text + 50 photo + 50 Airbnb-listing battles, 15–20 seed-user votes each.
-- Generated by scripts/gen-seed-batch-2.ts from scripts/seed-batch-2/*. Idempotent.
-- Fake votes: source 'seed', email-less seed accounts → Brain "All data (AI view)" only, never Clean or Journey.
-- Undo: see the header of scripts/gen-seed-batch-2.ts.

-- 1. demo_* accounts look fake ("demo_dan"): give them sign-up style names.
UPDATE "user" u SET "handle" = v.nh
FROM (
  SELECT id, lower(regexp_replace(substr(handle, 6), '[^A-Za-z]', '', 'g')) || (1000 + abs(hashtext(id)) % 9000)::text AS nh
  FROM "user" WHERE handle LIKE 'demo\\_%' AND email IS NULL
) v
WHERE u.id = v.id AND length(v.nh) > 4 AND NOT EXISTS (SELECT 1 FROM "user" x WHERE x.handle = v.nh);
--> statement-breakpoint
INSERT INTO "user" ("id", "handle", "name", "is_adult_confirmed", "onboarded_at", "kid_ages", "created_at") VALUES
${userRows.join(",\n")}
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "battle" ("id", "slug", "author_id", "title", "context", "category_id", "tags", "created_at", "deadline")
SELECT v.id, v.slug, v.author, v.title, v.context, 'other', '{}'::jsonb, v.created_at, v.deadline FROM (VALUES
${battleRows.join(",\n")}
) AS v(id, slug, author, title, context, created_at, deadline)
WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = v.author)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "option" ("id", "battle_id", "side", "label", "description", "image_url", "url", "url_title")
SELECT v.id, v.battle_id, v.side::side, v.label, v.description, v.image_url, v.url, v.url_title FROM (VALUES
${optionRows.join(",\n")}
) AS v(id, battle_id, side, label, description, image_url, url, url_title)
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
-- 2. Every email-less (seed) account ends with at least 15 seed votes: top up on other open seed battles,
-- one short session each, sides following each battle's current split.
CREATE TEMP TABLE seed_targets (user_id text PRIMARY KEY, target int);
--> statement-breakpoint
INSERT INTO seed_targets VALUES
${targetRows.join(",\n")};
--> statement-breakpoint
INSERT INTO "vote" ("id", "battle_id", "user_id", "device_id", "side", "dwell_ms", "source", "created_at")
SELECT 'sv2_' || substr(md5(u.id || b.id), 1, 20), b.id, u.id, 'seedvote_u_' || substr(md5(u.id), 1, 12),
  (CASE WHEN random() < (b.votes_a + 1.0) / (b.votes_a + b.votes_b + 2.0) THEN 'A' ELSE 'B' END)::side,
  2200 + floor(random() * 9000)::int, 'seed',
  least(now() - interval '1 minute', greatest(b.created_at + interval '4 minutes', u.t0 + b.rn * interval '19 seconds'))
FROM (
  SELECT x.id, coalesce(t.target, 15 + abs(hashtext(x.id)) % 8) - (SELECT count(*) FROM "vote" v WHERE v.user_id = x.id AND v.source = 'seed') AS need,
    now() - (interval '1 hour' * (2 + abs(hashtext(x.id || 't0')) % 40)) AS t0
  FROM "user" x LEFT JOIN seed_targets t ON t.user_id = x.id
  WHERE x.email IS NULL AND x.banned_at IS NULL AND x.handle IS DISTINCT FROM 'picktwo'
) u
CROSS JOIN LATERAL (
  SELECT c.*, row_number() OVER (ORDER BY md5(u.id || c.id)) AS rn FROM "battle" c
  WHERE c.id LIKE 'seed\\_%' AND c.id NOT LIKE 'seed\\_b2\\_%' AND c.status = 'OPEN' AND c.visibility = 'PUBLIC' AND c.deadline > now() AND c.author_id <> u.id
    AND NOT EXISTS (SELECT 1 FROM "vote" v WHERE v.battle_id = c.id AND v.user_id = u.id)
  ORDER BY md5(u.id || c.id) LIMIT greatest(u.need, 0)
) b
WHERE u.need > 0
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DROP TABLE seed_targets;
--> statement-breakpoint
UPDATE "battle" b SET
  "votes_a" = (SELECT count(*) FROM "vote" v WHERE v.battle_id = b.id AND v.side = 'A'),
  "votes_b" = (SELECT count(*) FROM "vote" v WHERE v.battle_id = b.id AND v.side = 'B')
WHERE b.id LIKE 'seed\\_%';
`;
writeFileSync("drizzle/0032_seed_batch_2.sql", sql);

// Preview data for the HTML page.
writeFileSync(`${DIR}/batch2.preview.json`, JSON.stringify(battles.map((b) => ({
  id: b.id, slug: slug(b.id), kind: b.kind, title: b.title, story: b.story, cat: b.cat, pctA: b.pctA, votes: b.votes,
  author: [...posters, ...newUsers].find((p) => p.id === b.author)!.handle, newAuthor: b.author!.startsWith("seed_b2u_"),
  createdMin: b.createdMin, opts: b.opts,
  a: voters.reduce((s, v) => s + v.votes.filter((x) => x.b === b && x.side === "A").length, 0),
})), null, 1));

const perUser = voters.map((v) => v.votes.length);
console.log(`${battles.length} battles (${existingCount} by existing posters, ${battles.length - existingCount} by ${newUsers.filter((u) => batchPosts.get(u.id)).length} new), ${T} votes on new battles`);
console.log(`new-battle votes per user: min ${Math.min(...perUser)}, max ${Math.max(...perUser)}; target totals ${Math.min(...voters.map((v) => v.total))}–${Math.max(...voters.map((v) => v.total))}`);
console.log(`new handles: ${newUsers.map((u) => u.handle).join(", ")}`);
