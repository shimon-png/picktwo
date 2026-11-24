import { eq } from "drizzle-orm";
import { db } from "./db";
import { categories, users, battles, options, votes, outcomes } from "./db/schema";
import { CATEGORIES } from "@/lib/constants";
import { createSlug } from "@/lib/id";


type Demo = {
  cat: string;
  title: string;
  context: string;
  /** [label, description]. Demo battles are text-only (no cartoon images): they show as text cards. */
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
  { cat: "gifts", title: "Birthday gift for my art-loving 6 y/o?", context: "She loves drawing and crafts. Budget around $50. Party is Saturday!", a: ["Lego Art Set", "Build a mosaic picture brick by brick. Hangs on the wall when it's done."], b: ["Deluxe paint easel", "Two-sided easel with chalkboard, paper roll and paint cups. Gets used every day."], kidAge: ["AGE_5_8"], budget: "$25–50", occasion: "Birthday", hours: 30, split: 0.62, n: 21, reasonsA: ["Building + art is the best of both worlds", "Mine played with it for weeks"], reasonsB: ["Easels get used every single day", "More open-ended creativity"] },
  { cat: "gifts", title: "Christmas gift for a 3 y/o who never sits still", context: "Very active toddler, loves being outside.", a: ["Balance bike", "No pedals, no training wheels. Burns energy outside and learns balance fast."], b: ["Indoor climbing triangle", "Wooden climber for the living room. Works on rainy and snowy days too."], kidAge: ["AGE_3_4"], budget: "$50–100", occasion: "Holiday", hours: 70, split: 0.55, n: 34, reasonsA: ["Balance bikes = no training wheels later"], reasonsB: ["Works in winter too!"] },
  { cat: "gifts", title: "Stocking stuffer for a 9 y/o", context: "Into science and puzzles.", a: ["Crystal growing kit", "Grow real crystals in a week. Big wow moment when they appear."], b: ["Rubik's-style puzzle cube", "Small, cheap, and keeps a curious kid busy for months."], kidAge: ["AGE_9_12"], budget: "Under $25", occasion: "Holiday", hours: 12, split: 0.48, n: 15, reasonsA: ["The wow factor when crystals appear"], reasonsB: ["Lasts for years"] },
  { cat: "gifts", title: "Anniversary gift for my wife", context: "10 years! She loves travel and photos.", a: ["Custom photo book", "Ten years of our favorite photos in one book she can keep forever."], b: ["Weekend getaway", "Two nights somewhere new, just us. Make new memories instead of a thing."], budget: "$250+", occasion: "Other", hours: 48, split: 0.35, n: 40, reasonsB: ["Experiences > things", "Make new memories, then make the book"], reasonsA: ["Something to keep forever"] },
  { cat: "baby-names", title: "Baby girl due in March — which name?", context: "Last name is Peterson. We love classic names.", a: ["Eleanor", "Classic and elegant. Nicknames: Ellie, Nora, Nell."], b: ["Clara", "Short, sweet, and timeless. Flows nicely with Peterson."], hours: 120, split: 0.51, n: 63, reasonsA: ["Eleanor Peterson sounds so elegant", "Nickname options: Ellie, Nora"], reasonsB: ["Short and sweet, flows well"] },
  { cat: "baby-names", title: "Middle name for our son Leo", context: "Leo ___ Martinez", a: ["James", "Leo James Martinez. Simple, strong, classic."], b: ["Alexander", "Leo Alexander Martinez. Longer and a little more regal."], hours: 20, split: 0.58, n: 28 },
  { cat: "big-purchases", title: "Stroller for city living", context: "Lots of walking, small apartment, one flight of stairs.", a: ["Compact travel stroller", "Folds with one hand, fits in the closet, easy on the stairs."], b: ["Full-size jogging stroller", "Big wheels and real suspension for bumpy city sidewalks."], kidAge: ["AGE_0_2"], hours: 60, split: 0.71, n: 37, reasonsA: ["Stairs + small apartment = compact all the way"], reasonsB: ["Better suspension on bumpy sidewalks"] },
  { cat: "big-purchases", title: "Family car for 3 kids", context: "Two car seats + a booster.", a: ["Minivan", "Sliding doors, easy third row, tons of room for car seats."], b: ["3-row SUV", "AWD for snow and a bit more style, but a tighter third row."], hours: 96, split: 0.66, n: 52, reasonsA: ["Sliding doors are life-changing with kids", "So much easier to reach the third row"], reasonsB: ["Better in snow with AWD"] },
  { cat: "what-to-wear", title: "Outfit for a job interview at a design studio", context: "Creative agency, casual-ish office.", a: ["Blazer + jeans", "Polished but relaxed. Says I take this seriously but fit your vibe."], b: ["Simple black dress", "Timeless and clean. Lets the portfolio do the talking."], hours: 5, split: 0.6, n: 19, reasonsA: ["Polished but not stuffy"], reasonsB: ["Timeless, lets your portfolio shine"] },
  { cat: "what-to-wear", title: "Wedding guest — which color?", context: "Outdoor summer wedding in a vineyard.", a: ["Sage green", "Soft and earthy. Looks great against vineyard greenery."], b: ["Dusty pink", "Romantic and summery. Pops in photos."], hours: 40, split: 0.53, n: 31 },
  { cat: "home-design", title: "Kitchen cabinet color", context: "White countertops, oak floors, lots of light.", a: ["Navy blue", "Bold and classic. Navy with oak floors is a timeless combo."], b: ["Warm white", "Bright, airy, and safe for resale. Lets the light do the work."], hours: 144, split: 0.45, n: 44, reasonsA: ["Navy + oak is a classic combo"], reasonsB: ["Timeless, great for resale"] },
  { cat: "home-design", title: "Kids' room wall", context: "Shared room, 4 and 7 year olds.", a: ["Mural wallpaper", "A big dinosaur jungle scene that makes the room feel like an adventure."], b: ["Chalkboard wall", "Draw, erase, repeat. Grows with them as they get older."], kidAge: ["AGE_3_4", "AGE_5_8"], hours: 80, split: 0.4, n: 22 },
  { cat: "words", title: "Opening line for my wedding toast", context: "I'm the best man, groom is my brother.", a: ["\"For those who don't know me, I'm the one Mom likes best.\"", "Open with a laugh so the room relaxes."], b: ["\"I've known Sam his whole life — all 34 years.\"", "Open with heart and set a warm tone."], hours: 18, split: 0.67, n: 26, reasonsA: ["Starts with a laugh, room relaxes"], reasonsB: ["Heartfelt sets a nicer tone"] },
  { cat: "words", title: "Subject line for my cover letter email", context: "Applying for a product manager role.", a: ["Product Manager application — Jane Doe", "Plain and professional. Easy to find later."], b: ["Jane Doe: shipped 3 products used by 2M people", "Leads with results so it stands out in the inbox."], hours: 10, split: 0.3, n: 18 },
  // Closed loops (with outcomes) — show the report-back story
  { cat: "gifts", title: "First birthday gift", context: "Our son is turning 1. Grandparents want ideas.", a: ["Wooden activity cube", "Beads, gears and shapes on every side. Grows with them for years."], b: ["Ride-on push car", "Scoot around the house now, push-walker for first steps."], kidAge: ["AGE_0_2"], budget: "$50–100", occasion: "Birthday", hours: -60, split: 0.7, n: 45, outcome: { chosen: "A", thumb: "UP", note: "He plays with it every day — the crowd was right!" }, reasonsA: ["Grows with them for years"] },
  { cat: "gifts", title: "Gift for my 7 y/o nephew", context: "Loves dinosaurs and running around.", a: ["Dinosaur dig kit", "Chip real-looking fossils out of a plaster block. Very dino."], b: ["Kids' scooter", "Three wheels, light-up, and lots of running-around energy."], kidAge: ["AGE_5_8"], budget: "$25–50", occasion: "Birthday", hours: -100, split: 0.82, n: 50, outcome: { chosen: "B", thumb: "UP", note: "82% said the dig kit, but he hasn't gotten off the scooter since." } },
  { cat: "what-to-wear", title: "First date — restaurant downtown", context: "Nice Italian place.", a: ["Button-down shirt", "Crisp and classic. Safe bet for a nice Italian place."], b: ["Fitted sweater", "Relaxed but put together. Warmer and a little more approachable."], hours: -80, split: 0.44, n: 23, outcome: { chosen: "B", thumb: "UP", note: "Second date is booked 😉" } },
  { cat: "big-purchases", title: "Laptop for homeschooling", context: "Mostly browser, video calls, some drawing.", a: ["Chromebook", "Cheap, simple, great for typing and video calls."], b: ["iPad with keyboard", "Pricier, but she can draw with a pencil and type too."], kidAge: ["AGE_5_8"], hours: -90, split: 0.4, n: 30, outcome: { chosen: "A", thumb: "DOWN", note: "Should have listened — she wanted to draw more than type." } },
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
        // Believable sign-up style names (Alex, Nov 23: "demo_dan" is obviously fake).
        handle: `${p.name.toLowerCase()}${4100 + i * 613}`,
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
      { battleId: b.id, side: "A", label: d.a[0], description: d.a[1] },
      { battleId: b.id, side: "B", label: d.b[0], description: d.b[1] },
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
