/**
 * Auto-seeding (Alex + Shimon, Nov 26 2026): when the person ranked `autoSeedRank` (10th) by votes this week has
 * `autoSeedAt` (50) or fewer battles left in their deck, write `autoSeedCount` (100) more seed battles in the voice
 * of the earlier batches, `autoSeedPhotoPct` (30%) with photos. Pure rules only; the service is
 * `server/services/auto-seed.ts`. Seed rules (project memory): no cartoon/emoji images, real photos that fit the
 * headline, no comparisons of a person's looks in photo battles (both photos would have to show the same person),
 * believable usernames that fit the post's voice, no line under answers by default, the story never repeats the title.
 */
import { TITLE_MAX } from "./constants";

export type Voice = "F" | "M" | "N";
export type SeedKind = "text" | "photo";

/**
 * Topic mix for new batches. Alex (Nov 27 2026): half of every batch is money and affordability, jobs and layoffs
 * (AI too), the economy and political differences in families (`FOCUS_TOPICS`), the other half relationships and
 * everything else. Within each half about 30% are photo battles (`planSlots`).
 */
export const TOPIC_MIX: [topic: string, weight: number, brief: string][] = [
  ["money", 15, "affordability: rent going up, groceries, gas, credit card debt, student loans, splitting costs with a partner or friends, saying no to plans I can't afford, lending money to family"],
  ["jobs", 14, "jobs: layoffs, scared of losing my job (incl. to AI), my partner got laid off, job hunting for months, a lower-paying offer vs waiting, side hustles, asking for a raise when everyone's cutting back"],
  ["politics", 12, "political differences in families and couples: Republican parents and a Democrat kid or the other way round, a partner whose family votes the other way, holidays with relatives who vote differently, whether to invite them over, how to keep loving each other. About the relationship, never which party is right"],
  ["economy", 9, "the economy and prices: buy now or wait, recession worries, saving vs spending, moving somewhere cheaper, moving back in with parents, cutting back on holidays, weddings or trips because everything costs more"],
  ["couples", 14, "couples fights, 'who's right?' between me and my partner"],
  ["cheating", 10, "cheating, flirting, exes, phones, DMs, trust"],
  ["dating", 10, "dating apps (Hinge, Bumble, Tinder), first dates, who pays, situationships, texting"],
  ["wedding", 7, "weddings, bachelorettes, bridesmaids, proposals, rings, in-laws at weddings"],
  ["parenting", 5, "parenting, pregnancy, baby names, grandparents, school, chores (kids by age only, never names)"],
  ["life", 4, "roommates, friends, family drama, home, pets, everyday etiquette (little food)"],
];

/** The topics Alex wants half of every batch on (Nov 27 2026). */
export const FOCUS_TOPICS = ["money", "jobs", "politics", "economy"] as const;
export const isFocusTopic = (t: string) => (FOCUS_TOPICS as readonly string[]).includes(t);

/** Topics for a batch of `n`, in proportion to TOPIC_MIX, largest remainders first. */
export function topicPlan(n: number): string[] {
  const total = TOPIC_MIX.reduce((s, t) => s + t[1], 0);
  const raw = TOPIC_MIX.map(([t, w]) => ({ t, exact: (n * w) / total }));
  const out = raw.map((r) => ({ t: r.t, k: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let left = n - out.reduce((s, r) => s + r.k, 0);
  for (const r of [...out].sort((a, b) => b.rem - a.rem)) if (left-- > 0) r.k++;
  return out.flatMap((r) => Array<string>(r.k).fill(r.t));
}

/**
 * Kinds for a chunk of `topics` with `nPhoto` photo battles, spread evenly over the focus half and the rest
 * (Alex, Nov 27: ~30% photos in each half), then shuffled. Pure with a given `rand`.
 */
export function planSlots(topics: readonly string[], nPhoto: number, rand: () => number = Math.random): { kind: SeedKind; topic: string }[] {
  const shuffle = <T,>(xs: T[]) => xs.map((x) => ({ x, r: rand() })).sort((p, q) => p.r - q.r).map((p) => p.x);
  const focus = shuffle(topics.filter(isFocusTopic));
  const rest = shuffle(topics.filter((t) => !isFocusTopic(t)));
  const k = Math.max(0, Math.min(topics.length, nPhoto));
  let kf = topics.length ? Math.round((k * focus.length) / topics.length) : 0;
  kf = Math.min(kf, focus.length, k);
  const kr = Math.min(rest.length, k - kf);
  kf = Math.min(focus.length, k - kr);
  const tag = (xs: string[], n: number) => xs.map((topic, i) => ({ kind: (i < n ? "photo" : "text") as SeedKind, topic }));
  return shuffle([...tag(focus, kf), ...tag(rest, kr)]);
}

/** How many of a batch are photo battles. */
export function photoCount(count: number, photoPct: number): number {
  return Math.max(0, Math.min(count, Math.round((count * photoPct) / 100)));
}

// ---------- trigger ----------

export type SeedState = {
  /** The batch being written (null when none). */
  batch: { id: string; startedAt: string; target: number; photoTarget: number; made: number; photos: number; photoFails: number; reason: string } | null;
  lastFinishedAt: string | null;
  /** Someone is working on the batch until this time (stops two runs from writing at once). */
  runningUntil: string | null;
  lastCheck: { at: string; voters: number; rank: number; remaining: number | null; fired: boolean; note: string } | null;
  lastError: string | null;
  history: { id: string; at: string; made: number; photos: number; reason: string }[];
};

export const EMPTY_STATE: SeedState = { batch: null, lastFinishedAt: null, runningUntil: null, lastCheck: null, lastError: null, history: [] };

export type TriggerInput = {
  enabled: boolean;
  /** Battles left for the person at the threshold rank (null = fewer voters than that rank, or none at all). */
  remaining: number | null;
  threshold: number;
  lastFinishedAt: string | null;
  cooldownHours: number;
  now: Date;
};

/** Start a new batch? Off, cooling down after the last batch, or still above the threshold = no. */
export function shouldStartBatch(x: TriggerInput): { start: boolean; note: string } {
  if (!x.enabled) return { start: false, note: "Auto-seeding is off (economy autoSeed = 0)." };
  if (x.remaining == null) return { start: false, note: "No voters this week yet." };
  if (x.remaining > x.threshold) return { start: false, note: `${x.remaining} battles left, above ${x.threshold}.` };
  if (x.lastFinishedAt) {
    const hours = (x.now.getTime() - new Date(x.lastFinishedAt).getTime()) / 3600_000;
    if (hours < x.cooldownHours) return { start: false, note: `${x.remaining} battles left, but the last batch finished ${hours.toFixed(1)}h ago (waits ${x.cooldownHours}h).` };
  }
  return { start: true, note: `${x.remaining} battles left (at or under ${x.threshold}): writing a new batch.` };
}

/** The rank we watch: the 10th person, or the last one when fewer people voted this week. */
export function watchedRank(voters: number, rank: number): number | null {
  if (voters <= 0) return null;
  return Math.min(voters, Math.max(1, rank));
}

// ---------- deck order ----------

/** A battle a real person posted (incl. Pickbot crowd questions), as opposed to seed content. */
export function isHumanBattle(b: { id: string; authorHasEmail: boolean; pickbot?: boolean }): boolean {
  if (b.id.startsWith("seed_")) return false;
  return b.authorHasEmail || !!b.pickbot;
}

// ---------- writing quality ----------

export type SeedDraft = {
  kind: SeedKind;
  voice: Voice;
  topic: string;
  title: string;
  story: string;
  a: string;
  b: string;
  aLine: string;
  bLine: string;
  pctA: number;
  /** Photo battles: what each photo should show (a Pexels search). */
  queryA?: string;
  queryB?: string;
};

const AI_TELLS = [
  /\bnot (just |only )?an? [a-z]+, (but |not )an?\b/i, // "not a X, not a Y" / "not a X, but a Y"
  /\bdelve|\bnavigat(e|ing) (the|this)|\btapestry|\btestament to|\bjourney\b|\blandscape of|\bit'?s worth noting/i,
  /—/, // em dash
];
const EMOJI = /\p{Extended_Pictographic}/u;
/** Photo battles can't compare a person's looks: both photos would need the same person (Alex, Nov 23). */
const LOOKS = /\b(hair|haircut|bangs|bob|makeup|lipstick|lip|nails?|manicure|tattoo|outfit|dress|top|jeans|suit|tux|beard|shave|look|selfie|wear|bikini|swimsuit|heels|shoes|boots|sneakers|profile pic|photo of me)\b/i;
/** Political posts are about families, never about politicians or elections being stolen (Alex, Nov 27). */
const POLITICIANS = /\b(trump|biden|kamala|obama|vance|desantis|newsom|pelosi|aoc|maga|rigged|stolen election)\b/i;
const KIDS_IN_PHOTO = /\b(kid|kids|child|children|son|daughter|baby|toddler|newborn|teen|boy|girl)\b/i;

const words = (s: string) => (s.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => w.length > 2);

/** Share of the story's words that already appear in the title (high = the story repeats the title). */
export function storyRepeat(title: string, story: string): number {
  const t = new Set(words(title));
  const s = words(story);
  if (!s.length) return 0;
  return s.filter((w) => t.has(w)).length / s.length;
}

/** Word overlap between two titles (Jaccard on words longer than 2 letters). */
export function titleSimilarity(a: string, b: string): number {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both);
}

/** True when the title is (nearly) one we already have. */
export function isDuplicate(title: string, existing: readonly string[], max = 0.55): boolean {
  const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return existing.some((e) => e.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === norm || titleSimilarity(title, e) >= max);
}

/** Everything wrong with a draft (empty = good to post). `abusive` is the app's profanity check. */
export function draftProblems(d: SeedDraft, abusive: (s: string) => boolean): string[] {
  const p: string[] = [];
  const title = d.title.trim();
  if (title.length < 12) p.push("title too short");
  if (title.length > TITLE_MAX) p.push("title too long");
  if (!d.a.trim() || !d.b.trim()) p.push("missing an option");
  if (d.a.length > 60 || d.b.length > 60) p.push("option label over 60");
  if (d.a.trim().toLowerCase() === d.b.trim().toLowerCase()) p.push("options are the same");
  if (d.aLine.length > 140 || d.bLine.length > 140) p.push("option line over 140");
  if (d.story.length > 240) p.push("story too long");
  if (d.story && storyRepeat(title, d.story) > 0.5) p.push("story repeats the title");
  if (!(d.pctA >= 3 && d.pctA <= 97)) p.push("split out of range");
  const all = [title, d.story, d.a, d.b, d.aLine, d.bLine];
  if (all.some((s) => abusive(s))) p.push("profanity filter");
  if (all.some((s) => EMOJI.test(s))) p.push("emoji");
  if (all.some((s) => AI_TELLS.some((r) => r.test(s)))) p.push("sounds like AI");
  if (all.some((s) => POLITICIANS.test(s))) p.push("names a politician");
  if (d.kind === "photo") {
    if (!d.queryA?.trim() || !d.queryB?.trim()) p.push("photo search missing");
    if (LOOKS.test(`${d.a} ${d.b} ${d.queryA} ${d.queryB}`)) p.push("photo battle compares looks");
    if (KIDS_IN_PHOTO.test(`${d.queryA} ${d.queryB}`)) p.push("kids in a photo");
  }
  return p;
}

/** "He's right" / "She's right" answers tell us the poster's voice (for reusing older seed posters). */
export function voiceFromLabels(labels: string[]): Voice {
  const s = labels.join(" | ").toLowerCase();
  if (/\bhe'?s right\b|\bmy (husband|boyfriend|bf|fianc[eé])\b/.test(s)) return "F";
  if (/\bshe'?s right\b|\bmy (wife|girlfriend|gf|fianc[eé]e)\b/.test(s)) return "M";
  return "N";
}

// ---------- posters ----------

const F_NAMES = ["kaylee", "brooke", "jenna", "kelsey", "mackenzie", "haley", "shelby", "carly", "amber", "lindsey", "bailey", "kendra", "tessa",
  "jillian", "marissa", "alana", "bianca", "gianna", "noelle", "renee", "whitney", "kara", "delaney", "aubrey", "savannah", "harper", "lexi", "brynn",
  "dana", "callie", "rosa", "yesenia", "imani", "keisha", "anjali", "mei", "trinity", "erica", "jasmine", "chelsea", "paige", "megan", "kristen",
  "sierra", "taylor", "olivia", "hannah", "abby", "maddie", "kate", "leah", "jordan", "alexis", "destiny", "priya", "valeria", "monica", "tiana"];
const M_NAMES = ["derek", "travis", "cody", "garrett", "brett", "shane", "colton", "trevor", "dustin", "mario", "jamal", "devin", "wes", "zach",
  "kyle", "tyler", "josh", "ryan", "marcus", "luis", "andre", "nate", "connor", "eric", "jake", "sean"];
const LAST = ["miller", "harris", "thompson", "martin", "clark", "lewis", "robinson", "hughes", "foster", "price", "sanders", "ross", "henderson",
  "coleman", "jenkins", "perry", "powell", "long", "flores", "ramirez", "torres", "diaz", "morales", "ortiz", "gray", "ward", "brooks", "kelly", "howard", "shah",
  "nguyen", "patel", "kim", "garcia", "reyes", "bennett", "carter", "murphy", "rivera", "cooper"];
const F_SELF = ["lakeday", "porchswing", "latte", "tacotuesday", "beachbum", "bookclub", "thrifted", "nightshift", "gymrat", "sunsetchaser", "ranchwater",
  "boymom", "girlmom", "teachertired", "cowboyboots", "matcha", "dogmom", "overpacked", "planner", "spicymargs", "bridetobe", "newlywed", "nurselife"];
const M_SELF = ["golfdad", "grillmaster", "dadjokes", "liftandlurk", "fishing", "garagebeers", "fantasyfootball", "girldad", "bbqking"];

/**
 * A believable username for a new seed poster: ~3 in 4 look like the sign-up suggestion (name + 4 digits),
 * the rest are self-chosen ("ranchwater_kaylee"). Always /^[a-z0-9_]{3,20}$/. Pure with a given `rand`.
 */
export function seedHandle(voice: Voice, rand: () => number = Math.random): string {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const male = voice === "M" || (voice === "N" && rand() < 0.25);
  const f = pick(male ? M_NAMES : F_NAMES);
  const l = pick(LAST);
  if (rand() < 0.75) {
    const s = rand();
    const name = (s < 0.4 ? f : s < 0.6 ? f[0] + l : s < 0.75 ? f + l[0] : s < 0.88 ? f + l : f.slice(0, 2) + l.slice(0, 4)).slice(0, 10);
    return `${name}${1000 + Math.floor(rand() * 9000)}`;
  }
  const w = pick(male ? M_SELF : F_SELF);
  const h = rand() < 0.5 ? `${w}_${f.slice(0, rand() < 0.5 ? 4 : 10)}` : `${w}_${f}${10 + Math.floor(rand() * 89)}`;
  return h.slice(0, 20).replace(/_$/, "");
}

// ---------- votes ----------

/** Relative activity by New York hour (lunch and evenings busy, 3am quiet). */
export const HOURLY = [1.2, 0.7, 0.35, 0.2, 0.15, 0.2, 0.45, 0.9, 1.1, 1.0, 1.0, 1.1, 1.5, 1.4, 1.0, 1.0, 1.1, 1.3, 1.5, 1.8, 2.0, 2.1, 1.9, 1.6];

/** New York hour of a time (fixed −5h; close enough for spreading activity). */
const nyHour = (t: number) => (new Date(t).getUTCHours() + 19) % 24;

/** A time between `from` and `to` (ms), weighted to busy hours. */
export function humanTime(from: number, to: number, rand: () => number): number {
  if (to <= from) return from;
  for (let i = 0; i < 200; i++) {
    const t = from + rand() * (to - from);
    if (rand() * 2.1 < HOURLY[nyHour(t)]!) return t;
  }
  return from + rand() * (to - from);
}

/**
 * Seed votes for one battle: `n` voters' sides from the planned split (each voter leans a little), times spread
 * from a few minutes after posting until now, human dwell times. Pure with a given `rand`.
 */
export function planVotes(o: { n: number; pctA: number; createdAt: number; now: number; words: number; photo: boolean; rand: () => number }) {
  const { rand } = o;
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const out: { side: "A" | "B"; at: number; dwellMs: number }[] = [];
  for (let i = 0; i < o.n; i++) {
    const pA = Math.min(0.97, Math.max(0.03, o.pctA / 100 + gauss() * 0.07));
    const base = o.photo ? 2400 + o.words * 14 : 2600 + o.words * 28;
    const dwellMs = Math.round(Math.min(25000, Math.max(1100, base * Math.exp(gauss() * 0.45))));
    const at = Math.round(humanTime(o.createdAt + 4 * 60_000, o.now - 60_000, rand));
    out.push({ side: rand() < pA ? "A" : "B", at, dwellMs });
  }
  return out.sort((a, b) => a.at - b.at);
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
