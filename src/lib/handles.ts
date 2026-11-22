/**
 * Usernames. Sign-up suggests `suggestedHandle()` ("zoe4859", from the email's first name + 4 digits),
 * which users can edit; `generateHandle()` makes the kind of name people pick themselves ("brunchclub_mia").
 * Seed posters use both (mostly the suggested style) so they look like real sign-ups.
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

/** Name part from an email's local part: its leading letters (up to 10), or "" if there are fewer than 2. */
export function namePart(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
  const letters = local.match(/^[a-z]+/)?.[0] ?? "";
  return letters.length >= 2 ? letters.slice(0, 10) : "";
}

/** The username sign-up suggests: email name + 4 digits ("jessica.lee@…" → "jessica4859"), else "user4859". */
export function suggestedHandle(email: string | null | undefined, rand: () => number = Math.random): string {
  return `${namePart(email) || "user"}${1000 + Math.floor(rand() * 9000)}`;
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
