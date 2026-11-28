import { guessTheme } from "./theme-guess";

/**
 * Topics in the Vote deck (Alex, Nov 27 2026; plan: "Vote deck categories: UX plan"). The deck starts on Mix
 * (everything); people can narrow it to one topic with the chip row, the "stay on Mix or get more specific?" card or
 * a ?topic= link. A topic is a filter on the normal ranked feed, so real people's battles still come first.
 *
 * Each battle's topic comes from, in order: the poster's own pick (`battle.tags.topic`), word rules for the topics
 * the AI theme list doesn't have (babies, investing, current events), the auto-seed topic, then the AI theme
 * (`battle.tags.brain.theme`) or the word-match theme guess. Pure; tested in tests/unit/topics.test.ts.
 *
 * Only shown to the "topics" group of the topics A/B test (services/topics-test.ts).
 */
export const TOPICS = [
  { id: "couples", label: "Couples", hook: "Exes, cheating, dating, who's right?", tone: 3 },
  { id: "money", label: "Money & jobs", hook: "Rent, raises, layoffs, splitting bills", tone: 1 },
  { id: "family", label: "Family", hook: "Parents, in-laws, holidays, kids", tone: 4 },
  { id: "weddings", label: "Weddings", hook: "Plus-ones, speeches, bridesmaid drama", tone: 5 },
  { id: "friends", label: "Friends", hook: "Group chats, roommates, besties", tone: 2 },
  { id: "everyday", label: "Everyday life", hook: "Outfits, food, home, trips, gifts", tone: 6 },
  { id: "babies", label: "Babies", hook: "Pregnancy, names, newborns, toddlers", tone: 2 },
  { id: "investing", label: "Investing", hook: "Stocks, crypto, saving, real estate", tone: 1 },
  { id: "news", label: "Current events", hook: "Politics, the economy, the news", tone: 5 },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];
export type DeckTopic = TopicId | "mix";
export const MIX = "mix" as const;
export const TOPIC_IDS = TOPICS.map((t) => t.id) as TopicId[];

export const isTopic = (v: unknown): v is TopicId => typeof v === "string" && (TOPIC_IDS as string[]).includes(v);
/** A ?topic= value or cookie, cleaned: an unknown value is Mix. */
export const deckTopic = (v: unknown): DeckTopic => (isTopic(v) ? v : MIX);
export const topicLabel = (t: DeckTopic) => (t === MIX ? "Mix" : (TOPICS.find((x) => x.id === t)?.label ?? "Mix"));
export const topicTone = (t: DeckTopic) => (t === MIX ? 0 : (TOPICS.find((x) => x.id === t)?.tone ?? 6));

/** The browser remembers the topic it's on in this cookie, so the Vote page renders the right deck straight away. */
export const TOPIC_COOKIE = "cp_topic";

const BABIES =
  /\b(newborns?|pregnan\w*|baby shower|gender reveal|toddlers?|nursery|strollers?|daycare|diapers?|cribs?|breastfe\w*|formula|sleep[- ]train\w*|maternity|paternity|baby names?|name (?:our|the|my) (?:baby|son|daughter)|our baby|the baby|my baby (?:boy|girl)|having a baby|due date|first trimester|\d+ ?(?:month|week|mo)[- ]old|infant|potty)\b/i;
const INVESTING =
  /\b(invest\w*|stocks?|stock market|crypto\w*|bitcoin|ethereum|401\(?k\)?|roth|ira|index funds?|etfs?|portfolio|dividends?|real estate|rental propert\w*|brokerage|robinhood|s&p|bonds?|high[- ]yield|hysa|compound interest|emergency fund|retirement savings|day trad\w*)\b/i;
const NEWS =
  /\b(politic\w*|elections?|trump|biden|harris|democrats?|republicans?|maga|liberals?|conservatives?|left[- ]wing|right[- ]wing|tariffs?|recession|inflation|the economy|economy|the news|government|shutdown|congress|senate|immigration|abortion|gun control|voted for|votes? (?:red|blue)|ballot|president\w*)\b/i;

const THEME_TOPIC: Record<string, TopicId> = {
  couples: "couples",
  dating: "couples",
  cheating_trust: "couples",
  exes: "couples",
  weddings: "weddings",
  family_parenting: "family",
  friends: "friends",
  money: "money",
  career: "money",
};

const SEED_TOPIC: Record<string, TopicId> = { politics: "news", economy: "news", money: "money", jobs: "money" };

export type TopicInput = {
  title: string;
  context?: string | null;
  labelA?: string | null;
  labelB?: string | null;
  tags?: { topic?: unknown; brain?: { theme?: string } | null; seed?: { topic?: string } | null } | null;
};

/** The topic a battle belongs to. Every battle lands in exactly one (Everyday life when nothing matches). */
export function topicOf(b: TopicInput): TopicId {
  const own = b.tags?.topic;
  if (isTopic(own)) return own;
  const text = [b.title, b.context].filter(Boolean).join(" ");
  if (BABIES.test(text)) return "babies";
  if (INVESTING.test(text)) return "investing";
  const seedTopic = b.tags?.seed?.topic ? SEED_TOPIC[b.tags.seed.topic] : undefined;
  if (seedTopic === "news" || NEWS.test(text)) return "news";
  if (seedTopic) return seedTopic;
  const theme = b.tags?.brain?.theme ?? guessTheme(b);
  return THEME_TOPIC[theme] ?? "everyday";
}

/** Battles left per topic for a viewer, from the topics of the battles still in their deck. */
export function countTopics(topics: TopicId[]): Record<TopicId, number> {
  const out = Object.fromEntries(TOPIC_IDS.map((t) => [t, 0])) as Record<TopicId, number>;
  for (const t of topics) out[t] += 1;
  return out;
}

/**
 * "Stay on Mix or get more specific?" card (Alex, Nov 27): once per browser, after `at` picks in a deck visit,
 * only while on Mix and when no other special card is due.
 */
export function pickerDue(o: { picks: number; at: number; topic: DeckTopic; shown: boolean; busy: boolean }) {
  return o.at > 0 && !o.shown && !o.busy && o.topic === MIX && o.picks >= o.at;
}

/**
 * "3 Couples battles in a row, want only Couples?" (Alex, Nov 27): only for someone who has used Skip at least
 * `minSkips` times (so the deck pushing a topic at them by accident doesn't count), on Mix, after `run` votes in a
 * row on the same topic (never Everyday life), once per topic per browser.
 */
export function streakTopic(o: { recent: TopicId[]; run: number; skips: number; minSkips: number; topic: DeckTopic; offered: string[] }): TopicId | null {
  if (o.topic !== MIX || o.run < 2 || o.skips < o.minSkips || o.recent.length < o.run) return null;
  const last = o.recent.slice(-o.run);
  const t = last[0];
  if (t === "everyday" || !last.every((x) => x === t) || o.offered.includes(t)) return null;
  return t;
}

/**
 * Sign-up nudge inside a topic (Alex, Nov 27: "You've judged 10 Couples battles. Sign in to keep going."): for a
 * guest, after `at` votes in the topic they're on. Group A of the sign-up gate test gets a wall at `at`; group B a
 * closable card at `at` and every `every` votes after.
 */
export function topicGate(o: { votes: number; at: number; soft: boolean; every: number }): "wall" | "prompt" | null {
  if (o.at <= 0 || o.votes < o.at) return null;
  if (!o.soft) return "wall";
  const step = Math.max(1, o.every);
  return (o.votes - o.at) % step === 0 ? "prompt" : null;
}
