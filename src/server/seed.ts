import { eq } from "drizzle-orm";
import { db } from "./db";
import { categories, users, battles, options, votes, outcomes } from "./db/schema";
import { CATEGORIES } from "@/lib/constants";
import { createSlug } from "@/lib/id";

/** Emoji tile as an inline SVG data URL — demo imagery without external assets. */
export function emojiTile(emoji: string, bg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${bg}"/><text x="50%" y="54%" font-size="300" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

type Demo = {
  cat: string;
  title: string;
  context: string;
  a: [string, string];
  b: [string, string];
  kidAge?: string[];
  budget?: string;
  occasion?: string;
  hours: number; // deadline offset from now (negative = closed)
  split: number; // share voting A
  n: number;
  outcome?: { chosen: "A" | "B"; thumb: "UP" | "DOWN"; note: string };
  reasonsA?: string[];
  reasonsB?: string[];
};

const DEMOS: Demo[] = [
  { cat: "gifts", title: "Birthday gift for my art-loving 6 y/o?", context: "She loves drawing and crafts. Budget around $50. Party is Saturday!", a: ["Lego Art Set", "🧱"], b: ["Deluxe paint easel", "🎨"], kidAge: ["AGE_5_8"], budget: "$25–50", occasion: "Birthday", hours: 30, split: 0.62, n: 21, reasonsA: ["Building + art is the best of both worlds", "Mine played with it for weeks"], reasonsB: ["Easels get used every single day", "More open-ended creativity"] },
  { cat: "gifts", title: "Christmas gift for a 3 y/o who never sits still", context: "Very active toddler, loves being outside.", a: ["Balance bike", "🚲"], b: ["Indoor climbing triangle", "🧗"], kidAge: ["AGE_3_4"], budget: "$50–100", occasion: "Holiday", hours: 70, split: 0.55, n: 34, reasonsA: ["Balance bikes = no training wheels later"], reasonsB: ["Works in winter too!"] },
  { cat: "gifts", title: "Stocking stuffer for a 9 y/o", context: "Into science and puzzles.", a: ["Crystal growing kit", "💎"], b: ["Rubik's-style puzzle cube", "🧩"], kidAge: ["AGE_9_12"], budget: "Under $25", occasion: "Holiday", hours: 12, split: 0.48, n: 15, reasonsA: ["The wow factor when crystals appear"], reasonsB: ["Lasts for years"] },
  { cat: "gifts", title: "Anniversary gift for my wife", context: "10 years! She loves travel and photos.", a: ["Custom photo book", "📖"], b: ["Weekend getaway", "🏝️"], budget: "$250+", occasion: "Other", hours: 48, split: 0.35, n: 40, reasonsB: ["Experiences > things", "Make new memories, then make the book"], reasonsA: ["Something to keep forever"] },
  { cat: "baby-names", title: "Baby girl due in March — which name?", context: "Last name is Peterson. We love classic names.", a: ["Eleanor", "🌸"], b: ["Clara", "🌼"], hours: 120, split: 0.51, n: 63, reasonsA: ["Eleanor Peterson sounds so elegant", "Nickname options: Ellie, Nora"], reasonsB: ["Short and sweet, flows well"] },
  { cat: "baby-names", title: "Middle name for our son Leo", context: "Leo ___ Martinez", a: ["James", "👶"], b: ["Alexander", "👑"], hours: 20, split: 0.58, n: 28 },
  { cat: "big-purchases", title: "Stroller for city living", context: "Lots of walking, small apartment, one flight of stairs.", a: ["Compact travel stroller", "🛒"], b: ["Full-size jogging stroller", "🏃"], kidAge: ["AGE_0_2"], hours: 60, split: 0.71, n: 37, reasonsA: ["Stairs + small apartment = compact all the way"], reasonsB: ["Better suspension on bumpy sidewalks"] },
  { cat: "big-purchases", title: "Family car for 3 kids", context: "Two car seats + a booster.", a: ["Minivan", "🚐"], b: ["3-row SUV", "🚙"], hours: 96, split: 0.66, n: 52, reasonsA: ["Sliding doors are life-changing with kids", "So much easier to reach the third row"], reasonsB: ["Better in snow with AWD"] },
  { cat: "what-to-wear", title: "Outfit for a job interview at a design studio", context: "Creative agency, casual-ish office.", a: ["Blazer + jeans", "🧥"], b: ["Simple black dress", "👗"], hours: 5, split: 0.6, n: 19, reasonsA: ["Polished but not stuffy"], reasonsB: ["Timeless, lets your portfolio shine"] },
  { cat: "what-to-wear", title: "Wedding guest — which color?", context: "Outdoor summer wedding in a vineyard.", a: ["Sage green", "🌿"], b: ["Dusty pink", "🌷"], hours: 40, split: 0.53, n: 31 },
  { cat: "home-design", title: "Kitchen cabinet color", context: "White countertops, oak floors, lots of light.", a: ["Navy blue", "🔵"], b: ["Warm white", "⚪"], hours: 144, split: 0.45, n: 44, reasonsA: ["Navy + oak is a classic combo"], reasonsB: ["Timeless, great for resale"] },
  { cat: "home-design", title: "Kids' room wall", context: "Shared room, 4 and 7 year olds.", a: ["Mural wallpaper", "🦕"], b: ["Chalkboard wall", "🖍️"], kidAge: ["AGE_3_4", "AGE_5_8"], hours: 80, split: 0.4, n: 22 },
  { cat: "words", title: "Opening line for my wedding toast", context: "I'm the best man, groom is my brother.", a: ["\"For those who don't know me, I'm the one Mom likes best.\"", "😂"], b: ["\"I've known Sam his whole life — all 34 years.\"", "🥂"], hours: 18, split: 0.67, n: 26, reasonsA: ["Starts with a laugh, room relaxes"], reasonsB: ["Heartfelt sets a nicer tone"] },
  { cat: "words", title: "Subject line for my cover letter email", context: "Applying for a product manager role.", a: ["Product Manager application — Jane Doe", "📧"], b: ["Jane Doe: shipped 3 products used by 2M people", "🚀"], hours: 10, split: 0.3, n: 18 },
  // Closed loops (with outcomes) — show the report-back story
  { cat: "gifts", title: "First birthday gift", context: "Our son is turning 1. Grandparents want ideas.", a: ["Wooden activity cube", "🧸"], b: ["Ride-on push car", "🚗"], kidAge: ["AGE_0_2"], budget: "$50–100", occasion: "Birthday", hours: -60, split: 0.7, n: 45, outcome: { chosen: "A", thumb: "UP", note: "He plays with it every day — the crowd was right!" }, reasonsA: ["Grows with them for years"] },
  { cat: "gifts", title: "Gift for my 7 y/o nephew", context: "Loves dinosaurs and running around.", a: ["Dinosaur dig kit", "🦖"], b: ["Kids' scooter", "🛴"], kidAge: ["AGE_5_8"], budget: "$25–50", occasion: "Birthday", hours: -100, split: 0.82, n: 50, outcome: { chosen: "B", thumb: "UP", note: "82% said the dig kit, but he hasn't gotten off the scooter since." } },
  { cat: "what-to-wear", title: "First date — restaurant downtown", context: "Nice Italian place.", a: ["Button-down shirt", "👔"], b: ["Fitted sweater", "🧶"], hours: -80, split: 0.44, n: 23, outcome: { chosen: "B", thumb: "UP", note: "Second date is booked 😉" } },
  { cat: "big-purchases", title: "Laptop for homeschooling", context: "Mostly browser, video calls, some drawing.", a: ["Chromebook", "💻"], b: ["iPad with keyboard", "📱"], kidAge: ["AGE_5_8"], hours: -90, split: 0.4, n: 30, outcome: { chosen: "A", thumb: "DOWN", note: "Should have listened — she wanted to draw more than type." } },
];

const VOTER_PROFILES: { name: string; kidAges: string[]; country: string }[] = [
  { name: "Priya", kidAges: ["AGE_5_8"], country: "US" },
  { name: "Dan", kidAges: [], country: "US" },
  { name: "Maya", kidAges: ["AGE_5_8", "AGE_0_2"], country: "US" },
  { name: "Leo", kidAges: ["AGE_3_4"], country: "UK" },
  { name: "Sofia", kidAges: ["AGE_9_12"], country: "US" },
  { name: "Ana", kidAges: [], country: "CA" },
  { name: "Tom", kidAges: ["AGE_0_2"], country: "US" },
  { name: "Grace", kidAges: ["AGE_13_17"], country: "US" },
];

export async function seed({ demo = true }: { demo?: boolean } = {}) {
  await db
    .insert(categories)
    .values(CATEGORIES.map(({ id, name, emoji, featured, sort }) => ({ id, name, emoji, featured, sort })))
    .onConflictDoNothing();

  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const email of admins) await db.update(users).set({ role: "ADMIN" }).where(eq(users.email, email));

  if (!demo) return { ok: true, demo: false };
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.handle, "picktwo"));
  if (existing) return { ok: true, demo: "already seeded" };

  const [system] = await db
    .insert(users)
    .values({ handle: "picktwo", name: "crowdpick", bio: "Official demo battles", isAdultConfirmed: true, onboardedAt: new Date(), ppBalance: 120, country: "US" })
    .returning();
  const voters = await db
    .insert(users)
    .values(
      VOTER_PROFILES.map((p, i) => ({
        handle: `demo_${p.name.toLowerCase()}`,
        name: p.name,
        isAdultConfirmed: true,
        onboardedAt: new Date(),
        kidAges: p.kidAges as never,
        country: p.country,
        ppBalance: 20 + i * 7,
        dataConsent: true,
      })),
    )
    .returning();
  const authors = [system, ...voters.slice(0, 3)];

  let i = 0;
  for (const d of DEMOS) {
    const author = authors[i++ % authors.length];
    const now = Date.now();
    const deadline = new Date(now + d.hours * 3600_000);
    const createdAt = new Date(Math.min(now - 3600_000 * (2 + (i % 10)), deadline.getTime() - 3600_000 * 24));
    const nA = Math.round(d.n * d.split);
    const nB = d.n - nA;
    const [b] = await db
      .insert(battles)
      .values({
        slug: createSlug(),
        authorId: author.id,
        title: d.title,
        context: d.context,
        categoryId: d.cat,
        tags: { kidAge: d.kidAge as never, budget: d.budget, occasion: d.occasion },
        status: d.hours < 0 ? "CLOSED" : "OPEN",
        closedAt: d.hours < 0 ? deadline : null,
        deadline,
        dataConsent: true,
        votesA: nA,
        votesB: nB,
        createdAt,
      })
      .returning();
    await db.insert(options).values([
      { battleId: b.id, side: "A", label: d.a[0], imageUrl: emojiTile(d.a[1], "#E8E8FB") },
      { battleId: b.id, side: "B", label: d.b[0], imageUrl: emojiTile(d.b[1], "#FDE6E4") },
    ]);
    // A few real vote rows from demo voters carrying the reasons (counters already include synthetic votes)
    const reasonVotes = [
      ...(d.reasonsA ?? []).map((r) => ({ side: "A" as const, r })),
      ...(d.reasonsB ?? []).map((r) => ({ side: "B" as const, r })),
    ];
    let vi = 0;
    for (const rv of reasonVotes) {
      const voter = voters[(vi++ + i) % voters.length];
      if (voter.id === author.id) continue;
      await db.insert(votes).values({ battleId: b.id, userId: voter.id, side: rv.side, reason: rv.r, dwellMs: 4000, source: "feed" }).onConflictDoNothing();
    }
    if (d.outcome) await db.insert(outcomes).values({ battleId: b.id, userId: author.id, ...d.outcome, reportedAt: new Date(deadline.getTime() + 20 * 3600_000) });
  }
  return { ok: true, demo: DEMOS.length };
}
