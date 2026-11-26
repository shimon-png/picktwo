/**
 * "People like you are asking" (Alex + Shimon, Nov 26 2026): a deck card with three real questions people like you
 * worry about, picked from a bank of preset questions using what we know (the ad they came from, the season, their
 * sex and age from the about-you cards, and later the "What's on your mind this week?" topic). Before sign-up a
 * question opens as a real battle (the crowd answers right away); after sign-up it opens Pickbot with the question
 * filled in. Shimon's rule: rotate, so not everyone taps the same first question, and once a preset has been posted
 * to the crowd from Pickbot it never shows again (`retired`).
 *
 * Each preset has a real battle (id `ask_<preset id>`, tags.askingPreset, migration 0043 from
 * scripts/gen-asking-presets.ts) that stays out of the normal Vote feed. Pure; tested in tests/unit/asking.test.ts.
 */
import type { AGE_RANGE_IDS } from "./constants";

/** Same ids as the "What's on your mind this week?" card, so its answer can steer the pick. */
export const ASKING_TOPICS = ["money", "dating", "work", "family", "gifts", "life"] as const;
export type AskingTopic = (typeof ASKING_TOPICS)[number];
type Age = (typeof AGE_RANGE_IDS)[number];

export type AskingPreset = {
  id: string;
  /** The question, in the asker's own casual words. It's the battle title and the Pickbot question. */
  q: string;
  /** Optional one-line story. Never repeats the question. */
  context?: string;
  a: string;
  b: string;
  topic: AskingTopic;
  /** Only for this sex (from the about-you card). Unknown sex still sees it. */
  sex?: "FEMALE" | "MALE";
  /** Only for these age ranges. Unknown age still sees it. */
  ages?: Age[];
  /** Only in these months (1–12, New York time). */
  months?: number[];
  /** Extra words that, found in the ad / campaign tags, mark it as a likely worry (the topic id always counts). */
  keys?: string[];
};

const YOUNG: Age[] = ["AGE_18_24", "AGE_25_34"];
const MID: Age[] = ["AGE_25_34", "AGE_35_44"];
const HOLIDAYS = [11, 12];

export const ASKING_PRESETS: AskingPreset[] = [
  // Money
  { id: "m_refund", topic: "money", q: "Getting a $3k tax refund. Pay down my card or finally take a trip?", a: "Pay the card", b: "Take the trip", months: [2, 3, 4], keys: ["tax", "refund", "credit"] },
  { id: "m_grouptrip", topic: "money", q: "Do I tell my friends I can't afford the group trip, or just put it on my card?", a: "Tell them", b: "Put it on my card", keys: ["travel", "trip", "budget"] },
  { id: "m_rent", topic: "money", q: "Rent's going up $200 a month. Stay or move?", context: "I love my place but moving isn't cheap either.", a: "Stay", b: "Move", keys: ["rent", "apartment", "housing"] },
  { id: "m_brother", topic: "money", q: "My brother asked to borrow $1,500. Lend it or say no?", context: "He paid me back last time. Eventually.", a: "Lend it", b: "Say no", keys: ["loan", "family"] },
  { id: "m_blackfriday", topic: "money", q: "Buy the new phone on Black Friday or wait for it to drop more?", a: "Buy now", b: "Wait", months: [11], keys: ["deal", "sale", "shopping", "black friday", "phone"] },
  { id: "m_split", topic: "money", q: "Split the dinner bill evenly or just pay for what I ordered?", context: "I had a salad. They each had three cocktails.", a: "Split evenly", b: "Pay my part", keys: ["bill", "friends"] },
  { id: "m_house", topic: "money", q: "Save for a house or put the money in the market?", a: "Save for a house", b: "Invest it", ages: MID, keys: ["invest", "house", "saving", "finance"] },
  { id: "m_gym", topic: "money", q: "Is a $90 gym membership worth it if I only go twice a week?", a: "Worth it", b: "Cancel it", keys: ["fitness", "gym", "subscription"] },

  // Dating
  { id: "d_text_him", topic: "dating", q: "He hasn't texted back in two days. Text again or wait?", a: "Text again", b: "Wait", sex: "FEMALE", ages: YOUNG, keys: ["text", "relationship", "love"] },
  { id: "d_text_her", topic: "dating", q: "She hasn't texted back in two days. Text again or wait?", a: "Text again", b: "Wait", sex: "MALE", ages: YOUNG, keys: ["text", "relationship", "love"] },
  { id: "d_second", topic: "dating", q: "First date was just ok. Go on a second one?", a: "Give it a shot", b: "Don't bother", keys: ["date", "relationship"] },
  { id: "d_thanksgiving", topic: "dating", q: "Is it too soon to bring him home for Thanksgiving?", context: "We've been dating three months.", a: "Bring him", b: "Too soon", sex: "FEMALE", months: [10, 11], keys: ["thanksgiving", "holiday", "relationship"] },
  { id: "d_apps", topic: "dating", q: "Delete the dating apps or give it one more month?", a: "Delete them", b: "One more month", keys: ["hinge", "bumble", "tinder", "app", "single"] },
  { id: "d_ex", topic: "dating", q: "My ex wants to grab coffee. Go or not?", a: "Go", b: "Don't go", keys: ["ex", "breakup"] },
  { id: "d_pays", topic: "dating", q: "Who should pay on a first date these days?", a: "Whoever asked", b: "Split it", keys: ["date", "money"] },
  { id: "d_valentines", topic: "dating", q: "Valentine's Day: plan something big or keep it low key?", a: "Something big", b: "Low key", months: [1, 2], keys: ["valentine", "romance", "love"] },
  { id: "d_hinge_friend", topic: "dating", q: "Saw my friend's boyfriend on Hinge. Tell her or stay out of it?", a: "Tell her", b: "Stay out of it", keys: ["hinge", "cheating", "friend"] },
  { id: "d_movein", topic: "dating", q: "Move in together after six months, or wait a year?", a: "Move in", b: "Wait", ages: YOUNG, keys: ["relationship", "apartment", "boyfriend", "girlfriend"] },
  { id: "d_ask_text", topic: "dating", q: "Is it lame to ask her out over text instead of in person?", a: "Text is fine", b: "Do it in person", sex: "MALE", ages: YOUNG, keys: ["date", "text"] },
  { id: "d_engaged", topic: "dating", q: "Four years together. Do I bring up getting engaged or wait for him?", a: "Bring it up", b: "Wait for him", sex: "FEMALE", ages: MID, keys: ["engagement", "ring", "wedding", "proposal"] },
  { id: "d_propose", topic: "dating", q: "Proposing over the holidays. In front of her family or just the two of us?", a: "With her family", b: "Just us", sex: "MALE", months: HOLIDAYS, keys: ["proposal", "ring", "engagement"] },

  // Work
  { id: "w_offer", topic: "work", q: "Job offer pays $12k more but it's five days in the office. Take it?", a: "Take it", b: "Stay remote", keys: ["job", "career", "salary", "remote", "hiring"] },
  { id: "w_raise", topic: "work", q: "Ask for a raise now or wait for my review in March?", a: "Ask now", b: "Wait", months: [10, 11, 12, 1], keys: ["raise", "salary", "career"] },
  { id: "w_quit", topic: "work", q: "Quit my job without another one lined up?", a: "Quit", b: "Stay until I find one", keys: ["quit", "job", "career", "burnout"] },
  { id: "w_party", topic: "work", q: "Go to the office holiday party or skip it?", a: "Go", b: "Skip it", months: HOLIDAYS, keys: ["office", "party", "holiday"] },
  { id: "w_burnout", topic: "work", q: "Tell my boss I'm burned out, or push through till the holidays?", a: "Tell my boss", b: "Push through", months: [9, 10, 11, 12], keys: ["burnout", "boss", "stress"] },
  { id: "w_masters", topic: "work", q: "Go back to school for a master's or keep working?", a: "Go back", b: "Keep working", ages: YOUNG, keys: ["school", "degree", "college", "education"] },
  { id: "w_pto", topic: "work", q: "Use my PTO before it expires or cash it out?", a: "Take the days", b: "Cash it out", months: [10, 11, 12], keys: ["vacation", "pto", "time off"] },
  { id: "w_sidehustle", topic: "work", q: "Start a side hustle on weekends or actually rest?", a: "Side hustle", b: "Rest", keys: ["side hustle", "business", "money"] },
  { id: "w_credit", topic: "work", q: "Coworker took credit for my idea in a meeting. Say something or let it go?", a: "Say something", b: "Let it go", keys: ["coworker", "office", "boss"] },

  // Family
  { id: "f_host", topic: "family", q: "Host Thanksgiving this year or let my sister do it again?", a: "Host it", b: "Let her", months: [10, 11], keys: ["thanksgiving", "holiday", "hosting"] },
  { id: "f_xmas_his", topic: "family", q: "Christmas with my family or his this year?", context: "We did his last year but my mom is already asking.", a: "Mine", b: "His", sex: "FEMALE", months: HOLIDAYS, keys: ["christmas", "holiday", "in-laws"] },
  { id: "f_xmas_hers", topic: "family", q: "Christmas with my family or hers this year?", context: "We did hers last year and my mom brought it up twice.", a: "Mine", b: "Hers", sex: "MALE", months: HOLIDAYS, keys: ["christmas", "holiday", "in-laws"] },
  { id: "f_kids_q", topic: "family", q: "My mom keeps asking when we're having kids. Be honest or change the subject?", a: "Be honest", b: "Change the subject", ages: MID, keys: ["kids", "mom", "parents"] },
  { id: "f_reunion", topic: "family", q: "Skip the family reunion this summer?", context: "It's a six-hour drive and my cousins are a lot.", a: "Go", b: "Skip it", months: [5, 6, 7, 8], keys: ["family", "summer", "reunion"] },
  { id: "f_daycare", topic: "family", q: "Daycare or let my mom watch the baby three days a week?", a: "Daycare", b: "Grandma", ages: MID, keys: ["baby", "daycare", "parenting", "mom"] },
  { id: "f_wedding_gf", topic: "family", q: "Do I invite my dad's new girlfriend to my wedding?", a: "Invite her", b: "Don't", ages: MID, keys: ["wedding", "dad", "family"] },
  { id: "f_skip_home", topic: "family", q: "Tell my parents I'm not coming home for the holidays this year?", a: "Tell them", b: "Just go", months: [10, 11, 12], keys: ["holiday", "parents", "christmas", "travel"] },
  { id: "f_politics", topic: "family", q: "My uncle always starts on politics at Thanksgiving. Push back or change the subject?", a: "Push back", b: "Change the subject", months: [11], keys: ["thanksgiving", "politics", "family"] },

  // Gifts
  { id: "g_bf", topic: "gifts", q: "Gift for my boyfriend: something he needs or something fun?", a: "Something he needs", b: "Something fun", sex: "FEMALE", months: HOLIDAYS, keys: ["gift", "christmas", "boyfriend"] },
  { id: "g_gf", topic: "gifts", q: "Christmas gift for my girlfriend: jewelry or a weekend away?", a: "Jewelry", b: "A weekend away", sex: "MALE", months: HOLIDAYS, keys: ["gift", "christmas", "girlfriend", "jewelry"] },
  { id: "g_santa", topic: "gifts", q: "$25 Secret Santa at work. Gift card or an actual gift?", a: "Gift card", b: "Actual gift", months: HOLIDAYS, keys: ["secret santa", "gift", "office"] },
  { id: "g_mom", topic: "gifts", q: "Mom says she doesn't want anything for Christmas. Get her something anyway?", a: "Get her something", b: "Take her word", months: HOLIDAYS, keys: ["gift", "mom", "christmas"] },
  { id: "g_bestie", topic: "gifts", q: "How much should I spend on my best friend's birthday?", a: "Under $50", b: "$100 or more", keys: ["gift", "birthday", "friend"] },
  { id: "g_friendsgiving", topic: "gifts", q: "Going to a Friendsgiving. Bring a hostess gift or just a dish?", a: "Hostess gift", b: "Just a dish", months: [11], keys: ["friendsgiving", "thanksgiving", "host"] },
  { id: "g_wedding", topic: "gifts", q: "Wedding gift: something off the registry or cash?", a: "Registry", b: "Cash", months: [4, 5, 6, 7, 8, 9, 10], keys: ["wedding", "registry", "gift"] },

  // Life
  { id: "l_dryjan", topic: "life", q: "Doing Dry January this year. Worth it or pointless?", a: "Worth it", b: "Pointless", months: [12, 1], keys: ["new year", "health", "drinking"] },
  { id: "l_hair", topic: "life", q: "Cut my hair short or keep growing it out?", a: "Cut it", b: "Keep growing", sex: "FEMALE", keys: ["hair", "beauty", "style"] },
  { id: "l_dog", topic: "life", q: "Get a dog now or wait until I have a bigger place?", a: "Get the dog", b: "Wait", keys: ["dog", "pet", "puppy"] },
  { id: "l_flaky", topic: "life", q: "My friend keeps canceling last minute. Say something or let it fade?", a: "Say something", b: "Let it fade", keys: ["friend", "friendship"] },
  { id: "l_move", topic: "life", q: "Move to a new city for a fresh start, or stay near my friends?", a: "Move", b: "Stay", ages: YOUNG, keys: ["move", "city", "relocate"] },
  { id: "l_summer", topic: "life", q: "This summer: one big vacation or a few long weekends?", a: "One big trip", b: "Long weekends", months: [3, 4, 5, 6, 7], keys: ["travel", "vacation", "summer"] },
  { id: "l_vegas", topic: "life", q: "Friend's bachelorette in Vegas is $1,200 all in. Go or skip?", a: "Go", b: "Skip it", sex: "FEMALE", ages: YOUNG, keys: ["bachelorette", "wedding", "vegas", "travel"] },
];

export const presetById = (id: string | null | undefined) => (id ? (ASKING_PRESETS.find((p) => p.id === id) ?? null) : null);
/** The battle that backs a preset (migration 0043). */
export const presetBattleId = (id: string) => `ask_${id}`;

export type AskingInput = {
  /** Retired (posted from Pickbot) or already voted by this person. */
  exclude: ReadonlySet<string>;
  sex?: string | null;
  age?: string | null;
  /** 1–12, New York time. */
  month: number;
  /** Ad / campaign words of the visit (utm_*, landing page, referrer), any case. */
  campaign?: string | null;
  /** "What's on your mind this week?" answer, when there is one. */
  topic?: AskingTopic | null;
  /** Stable per person and round, so the same person sees the same three until the next round. */
  seed: string;
  n?: number;
};

/** FNV-1a 32-bit → [0, 1). Browser-safe copy of services/ranking.ts `hashUnit`. */
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** Can this person see it at all? Sex, age and season rules (unknown sex / age passes). */
export function eligible(p: AskingPreset, a: Pick<AskingInput, "sex" | "age" | "month">): boolean {
  if (p.sex && (a.sex === "FEMALE" || a.sex === "MALE") && a.sex !== p.sex) return false;
  if (p.ages && a.age && !p.ages.includes(a.age as Age)) return false;
  if (p.months && !p.months.includes(a.month)) return false;
  return true;
}

/** How likely a worry it is for this person. Topic pick > ad words > season > fits sex / age. */
export function presetScore(p: AskingPreset, a: Omit<AskingInput, "exclude" | "seed" | "n">): number {
  let s = 1;
  if (a.topic && p.topic === a.topic) s += 4;
  const c = (a.campaign ?? "").toLowerCase();
  if (c && [p.topic, ...(p.keys ?? [])].some((k) => c.includes(k))) s += 2;
  if (p.months) s += 0.75;
  if (p.sex && a.sex === p.sex) s += 0.75;
  if (p.ages && a.age && p.ages.includes(a.age as Age)) s += 0.75;
  return s;
}

/**
 * The questions to show: the most likely worries, with a per-person random factor so people don't all get the same
 * top three (Shimon), at most one per topic unless they picked a topic, in a shuffled order so the first slot isn't
 * always the best match.
 */
export function pickAsking(a: AskingInput, bank: readonly AskingPreset[] = ASKING_PRESETS): AskingPreset[] {
  const n = a.n ?? 3;
  const ranked = bank
    .filter((p) => !a.exclude.has(p.id) && eligible(p, a))
    .map((p) => ({ p, s: presetScore(p, a) * (0.2 + 0.8 * unit(`${a.seed}:${p.id}`)) }))
    .sort((x, y) => y.s - x.s);
  const out: AskingPreset[] = [];
  const topics = new Set<string>();
  for (const { p } of ranked) {
    if (out.length >= n) break;
    if (topics.has(p.topic) && p.topic !== a.topic) continue;
    out.push(p);
    topics.add(p.topic);
  }
  // Not enough different topics left: fill with the next best.
  for (const { p } of ranked) {
    if (out.length >= n) break;
    if (!out.includes(p)) out.push(p);
  }
  return out.sort((x, y) => unit(`${a.seed}:o:${x.id}`) - unit(`${a.seed}:o:${y.id}`));
}

/** Show the card now? At `at` picks this visit, then every `every` picks, up to `rounds` times; never on top of another card. */
export function askingDue(a: { picks: number; at: number; every: number; rounds: number; shown: number; busy: boolean }): boolean {
  if (a.busy || a.at <= 0 || a.shown >= a.rounds) return false;
  const next = a.at + a.shown * Math.max(1, a.every);
  return a.picks >= next;
}
