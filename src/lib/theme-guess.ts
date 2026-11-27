import type { BrainTags } from "./brain-tags";

/**
 * Theme for the Brain's theme-engagement table (Alex, Nov 24 2026: "which themes get the most engagement").
 * Battles keep their AI tag (`battle.tags.brain.theme`) when they have one; seed battles and anything the tagger
 * hasn't reached get a word-match guess from this file instead, using the same theme list, so every battle lands in
 * a bucket. First matching rule wins, so the specific themes (cheating, exes, weddings) come before the broad ones
 * (couples). Pure; tested in tests/unit/theme-guess.test.ts.
 */
type Theme = BrainTags["theme"];

const RULES: [Theme, RegExp][] = [
  // A parent asking about their own kid is parenting, even when the question is about dating or school.
  ["family_parenting", /\b(?:my|our) (?:\d+ ?(?:yo|year old|month old)|son|daughter|kids?|toddler|teen\w*|baby)\b/i],
  ["cheating_trust", /\b(cheat\w*|affair|flirt\w*|his phone|her phone|texts? (?:with|from) (?:a|another|his|her) |read (?:his|her|my \w+'s) (?:texts|messages|phone)|trust(?:ed)?|lik(?:e|es|ed|ing) (?:a |another )?(?:girl|guy|her|his ex)\S*|went through (?:my|his|her) phone|finsta|snooping|lied|lying|emotional affair|micro.?cheat\w*)\b/i],
  ["exes", /\b(ex|exes|ex's|ex-\w+|my ex|his ex|her ex|former (?:boyfriend|girlfriend|husband|wife)|broke up|breakup|break up|divorc\w*)\b/i],
  ["weddings", /\b(wedd\w*|bride\w*|bridal|groom\w*|bachelor\w*|honeymoon|propos\w*|engag\w*|ring|vows?|maid of honou?r|best man|reception|rsvp|elope\w*|plus.?ones?|registry)\b/i],
  ["dating", /\b(dat(?:e|es|ing)|first date|2nd date|second date|third date|hinge|bumble|tinder|match(?:es|ed)?|unmatch\w*|age gap|on (?:his|her|my) profile|rematch\w*|opener|bio|prompt|crush|ghost\w*|situationship|talking stage|swipe|apps?)\b/i],
  ["family_parenting", /\b(kids?|kid's|son|daughter|toddler|baby|babies|newborn|teen\w*|\d+ ?(?:yo|year old|month old)|mom|mother|dad|father|parent\w*|in-?laws?|mother-in-law|mil|grandma|grandpa|sister|brother|sibling\w*|famil(?:y|ies)|boys|girls (?:are|share)|nanny|daycare|recess|pregnan\w*|due date|cry it out|bedtime)\b/i],
  ["travel", /\b(girls'? (?:trip|weekend)|guys'? (?:trip|weekend)|babymoon|ski|(?:ski |road )?trip (?:to|with)|getaway)\b/i],
  ["friends", /\b(friends?|friend's|bestie|bff|best friend|roommate\w*|group chat|girls'? night|coworker's party)\b/i],
  ["couples", /\b(husband|wife|boyfriend|girlfriend|bf|gf|partner|fianc[eé]e?|spouse|he says|she says|who'?s right|marriage|married|anniversary|our relationship|my man|valentine\w*|i love you)\b/i],
  ["career", /\b(job|jobs|boss|manager|coworker\w*|co-worker\w*|interview\w*|salary|raise|promotion|offer|office|remote|hybrid|resign\w*|quit|career|resume|linkedin|sales email|client\w*|work|pitch\w*|investors?|startup|business|bakery)\b/i],
  ["money", /\b(money|budget|loan|debt|savings?|save up|invest\w*|401k|rent|mortgage|split the bill|venmo|pay(?:ing)? for|tip|tipping|afford|expensive|cheap|credit card|\$\d+)\b/i],
  ["travel", /\b(trip|travel\w*|vacation|flight|airport|airbnb|hotel|resort|cabin|beach|cruise|maui|tulum|cancun|paris|rome|tokyo|mexico|road trip|window or aisle|passport|getaway)\b/i],
  ["pets", /\b(dog|dogs|puppy|cat|cats|kitten|pet|pets|vet)\b/i],
  ["home", /\b(house|home|apartment|condo|kitchen|couch|sofa|bedroom|living room|paint|decor|furniture|tree|christmas tree|lawn|backyard|pool|hot tub|move in|moving|neighbou?r\w*|landlord)\b/i],
  ["fashion_beauty", /\b(dress|outfit|wear|shoes?|heels|sneakers|boots|jacket|blazer|cardigan|jeans|hair|haircut|bangs|bob|nails?|makeup|lip|lipstick|skincare|tattoo|beard|watch|bag|purse|jewelry|earrings|style|look)\b/i],
  ["food_drink", /\b(food|eat|eating|dinner|lunch|breakfast|brunch|pizza|burger|tacos?|sushi|pasta|cook\w*|recipe|restaurant|coffee|latte|tea|wine|beer|cocktails?|tequila|martinis?|shots?|dessert|cake|snack\w*|thanksgiving)\b/i],
  ["tech", /\b(iphone|android|samsung|pixel|phone|laptop|macbook|ipad|tablet|airpods|headphones|tv|console|ps5|xbox|switch|app|ai|chatgpt|computer|tesla|ev)\b/i],
  ["health_fitness", /\b(gym|workout|run|running|marathon|yoga|pilates|diet|weight|lose weight|protein|therap\w*|doctor|dentist|sleep|health\w*|sober|drinking less)\b/i],
  ["entertainment", /\b(movie|movies|show|netflix|series|concert|music|song|album|book|books|read|game|games|subtitles|tiktok|instagram|spotify|podcast|festival|halloween costume|costume)\b/i],
  ["school", /\b(school|college|university|class|homework|teacher|grad|graduation|major|exam|campus|dorm|tuition)\b/i],
  ["shopping", /\b(buy|buying|bought|purchase|order|amazon|target|costco|sale|gift|gifts|present)\b/i],
];

export function guessTheme(text: { title: string; context?: string | null; labelA?: string | null; labelB?: string | null }): Theme {
  const title = text.title ?? "";
  const rest = [text.context, text.labelA, text.labelB].filter(Boolean).join(" ");
  // The title decides first; the story and option labels only break a tie when the title matches nothing.
  for (const src of [title, rest]) {
    for (const [theme, re] of RULES) if (re.test(src)) return theme;
  }
  return "other";
}

/** The AI tag when there is one, else the word-match guess. */
export function themeOf(b: { tags?: { brain?: { theme?: string } } | null; title: string; context?: string | null; labelA?: string | null; labelB?: string | null }): {
  theme: Theme;
  ai: boolean;
} {
  const t = b.tags?.brain?.theme;
  if (t) return { theme: t as Theme, ai: true };
  return { theme: guessTheme(b), ai: false };
}

export const themeLabel = (t: string) =>
  ({
    cheating_trust: "Cheating & trust",
    family_parenting: "Family & parenting",
    fashion_beauty: "Fashion & beauty",
    food_drink: "Food & drink",
    health_fitness: "Health & fitness",
  })[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
