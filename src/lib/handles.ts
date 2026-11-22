/**
 * Friendly generated usernames like "brunchclub_mia" or "latenight_jo27".
 * Used to prefill the sign-up username (still editable) and for seed profiles, so both look alike.
 * Pure: pass your own random function to make it deterministic.
 */
export const HANDLE_WORDS = [
  "brunchclub", "sundayreset", "latenight", "icedlatte", "oatmilk", "softlife", "maincharacter", "goldenhour",
  "matchapls", "nightowl", "plantmom", "sunsetchaser", "coffeerun", "hotgirlwalk", "cozyseason", "beachbum",
  "citylights", "readingnook", "slowmornings", "pinotnoir", "taconight", "roadtrip", "mondaymood", "cutesy",
  "lowkey", "honestly", "overthinker", "deepthinker", "realtalk", "nofilter", "petty", "chaotic",
  "sweettooth", "pizzaparty", "doglover", "catperson", "gymrat", "yogi", "runclub", "pickleball",
  "bookclub", "wineo", "spicymarg", "lazysunday", "busybee", "daydreamer", "wanderlust", "homebody",
  "cupcake", "peachy", "honeybee", "wildflower", "moonchild", "starlight", "cloudnine", "seaside",
  "brooklyn", "southside", "midwest", "texas", "jersey", "socal", "nola", "chicago",
  "newmom", "boymom", "girldad", "auntie", "newlywed", "engaged", "singleagain", "datingapp",
  "bridetobe", "maidofhonor", "groomsman", "wfh", "nineto5", "sidehustle", "corporate", "nurse",
];

export const HANDLE_NAMES = [
  "mia", "jess", "kay", "em", "sam", "jo", "liv", "ash", "tay", "bri", "dani", "nat", "alex", "jen", "kat",
  "mo", "lu", "ria", "ty", "ben", "max", "nick", "chris", "dev", "jay", "ray", "zoe", "ivy", "ella", "nina",
  "maya", "lexi", "gabs", "steph", "megs", "cass", "lily", "rose", "jules", "nora", "amir", "leo", "sofi", "vee",
];

/** Name part from an email's local part: its leading letters, 2–6 of them, or "" if there aren't enough. */
export function namePart(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
  const letters = local.match(/^[a-z]+/)?.[0] ?? "";
  return letters.length >= 2 ? letters.slice(0, 6) : "";
}

/**
 * A username: word + "_" + a short name (or 2 digits), sometimes with 2 trailing digits.
 * Always matches /^[a-z0-9_]{3,20}$/.
 */
export function generateHandle(opts: { name?: string; rand?: () => number } = {}): string {
  const rand = opts.rand ?? Math.random;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const digits = () => String(10 + Math.floor(rand() * 90));
  const name = (opts.name ?? "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 6);
  const numeric = !name && rand() >= 0.75;
  const tail = name || (numeric ? digits() : pick(HANDLE_NAMES));
  const word = pick(HANDLE_WORDS);
  let h = `${word}_${tail}`;
  if (!numeric && rand() < 0.3 && h.length <= 18) h += digits();
  return h.slice(0, 20).replace(/_$/, "");
}
