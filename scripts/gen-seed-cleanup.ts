/**
 * Writes drizzle/0017_seed_cleanup.sql (Alex, Nov 22 2026):
 *  - launch battles: options + contexts re-synced from scripts/launch-battles.data.ts (lines in the poster's own
 *    first-person voice, no slogans like "protect your peace", nothing that repeats the title or story);
 *  - the older seeds (0003/0011/0012/0013): answer lines rewritten the same way, a context that repeated the title dropped;
 *  - seed posters whose username didn't fit the post (a "kyle" asking about "my bridesmaids") renamed, and three
 *    posts moved to a poster who fits.
 *
 *   npx tsx scripts/gen-seed-cleanup.ts
 */
import { writeFileSync } from "node:fs";
import { LAUNCH_BATTLES } from "./launch-battles.data";
import { isAbusive } from "../src/server/moderation";

/** Older seeds: battle id → [A line, B line, new context?]. Labels stay. Default is no line under the option (Alex); "" = none. */
const OLD: Record<string, [string, string, string?]> = {
  seed_b_56: ["", ""],
  seed_b_57: ["", "safe, but I wore black to the last 3"],
  seed_b_58: ["", ""],
  seed_b_59: ["", ""],
  seed_b_60: ["", ""],
  seed_b_61: ["", ""],
  seed_b_62: ["", "he'll actually smile in this one"],
  seed_b_63: ["", ""],
  seed_b_64: ["", ""],
  seed_b_66: ["", "", ""],
  seed_b_67: ["", ""],
  seed_b_68: ["", ""],
  seed_b_69: ["", ""],
  seed_b_71: ["", ""],
  seed_b_73: ["", ""],
  seed_b_74: ["", ""],
  seed_b_76: ["", ""],
  seed_b_79: ["", ""],
  seed_b_80: ["", ""],
  seed_lb_1: ["", ""],
  seed_lb_10: ["", ""],
  seed_lb_11: ["", ""],
  seed_lb_12: ["", ""],
  seed_lb_13: ["", ""],
  seed_lb_14: ["", ""],
  seed_lb_15: ["", ""],
  seed_lb_16: ["", ""],
  seed_lb_17: ["", ""],
  seed_lb_18: ["", ""],
  seed_lb_19: ["", "I'd ruin the ceiling, I know me"],
  seed_lb_2: ["", ""],
  seed_lb_20: ["", ""],
  seed_lb_3: ["", ""],
  seed_lb_4: ["", ""],
  seed_lb_5: ["", ""],
  seed_lb_6: ["", "I pee a lot, sorry"],
  seed_lb_7: ["", ""],
  seed_lb_8: ["", ""],
  seed_lb_9: ["", ""],
  seed_pb_1: ["", ""],
  seed_pb_10: ["", ""],
  seed_pb_2: ["", ""],
  seed_pb_3: ["what I wore at his age", ""],
  seed_pb_4: ["", ""],
  seed_pb_5: ["", ""],
  seed_pb_6: ["", ""],
  seed_pb_7: ["", ""],
  seed_pb_8: ["", ""],
  seed_pb_9: ["", ""],
  seed_tb_1: ["", ""],
  seed_tb_10: ["", ""],
  seed_tb_11: ["", ""],
  seed_tb_12: ["", "I make a really good pie"],
  seed_tb_13: ["", ""],
  seed_tb_14: ["", ""],
  seed_tb_15: ["", ""],
  seed_tb_16: ["", ""],
  seed_tb_17: ["", ""],
  seed_tb_18: ["", ""],
  seed_tb_19: ["", ""],
  seed_tb_2: ["", ""],
  seed_tb_20: ["", ""],
  seed_tb_21: ["", ""],
  seed_tb_22: ["", "it was my grandpa's name"],
  seed_tb_23: ["for my nonna", ""],
  seed_tb_24: ["", "my grandmother, we'd call her Maggie"],
  seed_tb_25: ["", ""],
  seed_tb_26: ["", ""],
  seed_tb_27: ["", ""],
  seed_tb_28: ["", ""],
  seed_tb_29: ["I'll be 36 either way", ""],
  seed_tb_3: ["", ""],
  seed_tb_30: ["", ""],
  seed_tb_4: ["", ""],
  seed_tb_5: ["", ""],
  seed_tb_6: ["", ""],
  seed_tb_7: ["", ""],
  seed_tb_8: ["", ""],
  seed_tb_9: ["", ""],
};

/** Posters whose name didn't match their post: current handle → new handle (same "suggested" style). */
const RENAME: Record<string, string> = {
  // women posting as men
  david9858: "dana9858", ryan6838: "rachel6838", matt7171: "maddie7171", kevin2947: "kelly2947",
  dankim3676: "danikim3676", jake2161: "jade2161", benb4620: "bethb4620", kyle4977: "kylie4977",
  jon2960: "joanna2960", carlosb3162: "carlab3162", chriscruz6693: "ccruz6693", josh1156: "josie1156",
  luis4898: "luisa4898",
  // men posting as women
  pizzaparty_ella: "pizzaparty_eli", ashleyw5418: "andreww5418", amandar2182: "adamr2182",
  stephanie8265: "stephen8265", newmom_jules: "nightowl_jules", petty_nina: "petty_nico",
  jasminek3558: "jasonk3558", sophial4659: "sethl4659", graceb2487: "gregb2487", sarah1579: "sean1579",
};
/** Posts moved to a poster who fits (launch battle # → current handle of the new poster). */
const MOVE: Record<number, string> = { 6: "omar1759", 23: "lpatel8326", 94: "chaotic_ben" };

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const qn = (s: string) => (s ? q(s) : "NULL");
const errors: string[] = [];
const check = (where: string, t: string, max: number) => {
  if (t.length > max) errors.push(`${where} too long: ${t}`);
  if (isAbusive(t)) errors.push(`${where} blocked word: ${t}`);
  if (/\byour?\b/i.test(t) && max === 140) console.warn(`note ${where} 2nd person: ${t}`);
};
LAUNCH_BATTLES.forEach(([, c, al, ad, bl, bd], i) => {
  check(`#${i + 1} context`, c, 280);
  for (const l of [al, bl]) if (!l) errors.push(`#${i + 1} empty label`); else check(`#${i + 1} label`, l, 60);
  check(`#${i + 1} A`, ad, 140);
  check(`#${i + 1} B`, bd, 140);
});
for (const [id, [a, b, c]] of Object.entries(OLD)) {
  check(`${id} A`, a, 140);
  check(`${id} B`, b, 140);
  if (c) check(`${id} context`, c, 280);
}
if (new Set(Object.values(RENAME)).size !== Object.keys(RENAME).length) errors.push("duplicate new handle");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const ctx = [
  ...LAUNCH_BATTLES.map(([, c], i) => `  ('seed_vb_${i + 1}', ${q(c)})`),
  ...Object.entries(OLD)
    .filter(([, v]) => v[2] !== undefined)
    .map(([id, v]) => `  (${q(id)}, ${q(v[2]!)})`),
];
const opts = [
  ...LAUNCH_BATTLES.flatMap(([, , al, ad, bl, bd], i) => [
    `  ('seed_vb_${i + 1}', 'A', ${q(al)}, ${qn(ad)})`,
    `  ('seed_vb_${i + 1}', 'B', ${q(bl)}, ${qn(bd)})`,
  ]),
];
const oldOpts = Object.entries(OLD).flatMap(([id, [a, b]]) => [
  `  (${q(id)}, 'A', ${qn(a)})`,
  `  (${q(id)}, 'B', ${qn(b)})`,
]);
const moves = Object.entries(MOVE).map(([n, h]) => `  ('seed_vb_${n}', ${q(h)})`);
const renames = Object.entries(RENAME).map(([o, n]) => `  (${q(o)}, ${q(n)})`);

const sql = `-- Seed cleanup (Alex, Nov 22 2026). Generated by scripts/gen-seed-cleanup.ts.
-- Answer lines in the poster's own voice, no context that repeats the title, posters' names fit their posts.
UPDATE "battle" b SET "context" = v.c, "updated_at" = now()
FROM (VALUES
${ctx.join(",\n")}
) AS v(id, c)
WHERE b.id = v.id;
--> statement-breakpoint
UPDATE "option" o SET "label" = v.l, "description" = v.d
FROM (VALUES
${opts.join(",\n")}
) AS v(bid, s, l, d)
WHERE o.battle_id = v.bid AND o.side::text = v.s;
--> statement-breakpoint
UPDATE "option" o SET "description" = v.d
FROM (VALUES
${oldOpts.join(",\n")}
) AS v(bid, s, d)
WHERE o.battle_id = v.bid AND o.side::text = v.s AND o.id LIKE 'seed%';
--> statement-breakpoint
UPDATE "battle" b SET "author_id" = u.id
FROM (VALUES
${moves.join(",\n")}
) AS v(id, h)
JOIN "user" u ON u.handle = v.h AND u.id LIKE 'seed%'
WHERE b.id = v.id;
--> statement-breakpoint
UPDATE "user" u SET "handle" = v.n, "name" = v.n
FROM (VALUES
${renames.join(",\n")}
) AS v(o, n)
WHERE u.handle = v.o AND u.id LIKE 'seed%'
  AND NOT EXISTS (SELECT 1 FROM "user" x WHERE x.handle = v.n);
`;
writeFileSync("drizzle/0017_seed_cleanup.sql", sql);
console.log(`${LAUNCH_BATTLES.length} launch + ${Object.keys(OLD).length} older battles, ${Object.keys(RENAME).length} renames, ${moves.length} moves`);
