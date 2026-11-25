/**
 * About-you cards (About-you plan, Nov 25 2026). The server decides after each new vote whether the deck shows a
 * card next (`aboutAfterVote`, rules in lib/about.ts `nextAboutCard`), records every card shown, and saves the
 * answer or skip (`answerAbout`). A guest's answers live on their browser and move onto the account when they sign
 * up (`moveDeviceAnswers`, called from linkDevice); sign-up then skips anything already answered.
 * A stable `aboutHoldoutPct` share of people never sees a card, so the Brain can measure what cards cost in votes.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { devices, profileAnswers, users, type KidAge, type User } from "../db/schema";
import { getEconomy } from "./config";
import { inHoldout } from "./ranking";
import { lookupZip, zipPlace } from "./zip";
import { generateHandle } from "@/lib/handles";
import { track, trackProfileChanges } from "../analytics";
import { AppError } from "../errors";
import { ABOUT_QUESTIONS, isValidAboutAnswer, nextAboutCard, type AboutQuestionId, type AboutSchedule } from "@/lib/about";
import { KID_AGE_IDS } from "@/lib/constants";
import { likeYouView, type LikeYou, type LikeYouVote } from "@/lib/like-you";

type Viewer = { user: User | null; deviceId: string | null };

/** Which user column holds each answer (guests keep answers on their browser rows only). */
const USER_FIELD = {
  sex: "sex",
  age: "ageRange",
  relationship: "relationship",
  zip: "zipCode",
  kids: "kidsStatus",
  housing: "housing",
  work: "workStatus",
} as const satisfies Record<AboutQuestionId, keyof User>;

const ownerCond = (v: Viewer) => (v.user ? eq(profileAnswers.userId, v.user.id) : eq(profileAnswers.deviceId, v.deviceId!));

export const aboutArm = (v: Viewer, pct: number) => (inHoldout(`about:${v.user?.id ?? v.deviceId ?? ""}`, pct) ? "holdout" : "cards");

/** Latest answer per question from this browser's card rows (guests). */
export async function deviceAnswers(deviceId: string): Promise<Partial<Record<AboutQuestionId, string>>> {
  const rows = await db
    .select({ q: profileAnswers.question, a: profileAnswers.answer })
    .from(profileAnswers)
    .where(and(eq(profileAnswers.deviceId, deviceId), eq(profileAnswers.status, "answered")))
    .orderBy(desc(profileAnswers.createdAt));
  const out: Partial<Record<AboutQuestionId, string>> = {};
  for (const r of rows) if (r.a && !(r.q in out)) out[r.q as AboutQuestionId] = r.a;
  return out;
}

/** What we know about this person, from their account or (guest) their browser's answers. */
export async function knownAnswers(v: Viewer): Promise<Partial<Record<AboutQuestionId, string>>> {
  if (v.user) {
    const out: Partial<Record<AboutQuestionId, string>> = {};
    for (const [q, f] of Object.entries(USER_FIELD) as [AboutQuestionId, keyof User][]) {
      const val = v.user[f];
      if (typeof val === "string" && val && val !== "UNDISCLOSED") out[q] = val;
    }
    return out;
  }
  return v.deviceId ? deviceAnswers(v.deviceId) : {};
}

async function voteCount(v: Viewer): Promise<number> {
  const [r] = v.user
    ? await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vote WHERE user_id = ${v.user.id}`)
    : await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vote v
        WHERE v.device_id = ${v.deviceId} OR v.user_id = (SELECT d.user_id FROM device d WHERE d.id = ${v.deviceId})`);
  return Number(r?.n ?? 0);
}

export type AboutCardPayload = { id: AboutQuestionId; zipGuess?: string | null; cityGuess?: string | null };

/**
 * After a new vote: the about-you card to show next, or null. Records the showing (so "never two in a row" and the
 * skip rules work across devices and reloads). Never throws: a card is a nice-to-have, the vote already counted.
 */
export async function aboutAfterVote(v: Viewer): Promise<AboutCardPayload | null> {
  if (!v.user && !v.deviceId) return null;
  try {
    const e = await getEconomy();
    if (aboutArm(v, e.aboutHoldoutPct) === "holdout") return null;
    const [votes, known, rows] = await Promise.all([
      voteCount(v),
      knownAnswers(v),
      db.select().from(profileAnswers).where(ownerCond(v)).orderBy(desc(profileAnswers.createdAt)).limit(100),
    ]);
    const answered = new Set(Object.keys(known) as AboutQuestionId[]);
    for (const r of rows) if (r.status === "answered") answered.add(r.question as AboutQuestionId);
    const skipped = new Map<AboutQuestionId, { times: number; atVotes: number }>();
    for (const r of rows) {
      if (r.status !== "skipped") continue;
      const cur = skipped.get(r.question as AboutQuestionId);
      skipped.set(r.question as AboutQuestionId, { times: (cur?.times ?? 0) + 1, atVotes: Math.max(cur?.atVotes ?? 0, r.atVotes) });
    }
    const lastCard = rows.find((r) => r.via === "card");
    const q = nextAboutCard(
      { votes, signedIn: !!v.user, answered, skipped, lastAskAt: lastCard ? lastCard.atVotes : null },
      e as unknown as AboutSchedule,
    );
    if (!q) return null;
    await db.insert(profileAnswers).values({ userId: v.user?.id ?? null, deviceId: v.user ? null : v.deviceId, question: q, status: "shown", via: "card", atVotes: votes });
    if (q !== "zip") return { id: q };
    // ZIP card: start from the IP guess, so for many people it's one confirm tap.
    const [d] = v.deviceId ? await db.select({ zip: devices.ipZip, city: devices.ipCity, country: devices.ipCountry }).from(devices).where(eq(devices.id, v.deviceId)) : [];
    return { id: q, zipGuess: d?.country === "US" ? (d.zip ?? null) : null, cityGuess: d?.country === "US" ? (d.city ?? null) : null };
  } catch (err) {
    console.error("[about] next card", err);
    return null;
  }
}

/**
 * Save an answer (or a skip: answer null) to an about-you card, or from sign-up / Settings (`via`). Signed in: also
 * writes the user's profile column. Returns what we now know, for the "people like you" bar.
 */
export async function answerAbout(
  v: Viewer,
  input: { question: AboutQuestionId; answer: string | null; kidAges?: string[]; via?: "card" | "signup" | "settings" },
) {
  if (!v.user && !v.deviceId) throw new AppError("VALIDATION", "Please enable cookies");
  const q = ABOUT_QUESTIONS[input.question];
  if (!q) throw new AppError("VALIDATION", "Unknown question");
  if (q.afterSignup && !v.user) throw new AppError("UNAUTHORIZED", "Sign up first");
  let answer = input.answer?.trim() || null;
  let place: { country?: string | null; region?: string | null; city?: string | null } = {};
  if (answer) {
    if (!isValidAboutAnswer(q.id, answer)) throw new AppError("VALIDATION", "Pick one of the answers");
    if (q.id === "zip") {
      const z = lookupZip(answer, v.user?.country ?? "US");
      if (!z.ok) throw new AppError("VALIDATION", z.message);
      answer = z.code;
      place = { country: z.country, region: z.region, city: z.city };
    }
  }
  const status = answer ? "answered" : "skipped";
  const via = input.via ?? "card";
  // Close the card that was shown, else record a new row (sign-up / Settings).
  const [shown] = await db
    .select({ id: profileAnswers.id })
    .from(profileAnswers)
    .where(and(ownerCond(v), eq(profileAnswers.question, q.id), eq(profileAnswers.status, "shown")))
    .orderBy(desc(profileAnswers.createdAt))
    .limit(1);
  if (shown && via === "card") await db.update(profileAnswers).set({ answer, status, updatedAt: new Date() }).where(eq(profileAnswers.id, shown.id));
  else await db.insert(profileAnswers).values({ userId: v.user?.id ?? null, deviceId: v.user ? null : v.deviceId, question: q.id, answer, status, via, atVotes: await voteCount(v) });

  const kidAges = (input.kidAges ?? []).filter((k): k is KidAge => (KID_AGE_IDS as readonly string[]).includes(k));
  if (answer && v.user) {
    const field = USER_FIELD[q.id];
    const patch: Partial<User> = { [field]: answer };
    if (q.id === "zip" && !v.user.country) Object.assign(patch, place);
    if (q.id === "kids") patch.kidAges = answer === "YES" ? kidAges : [];
    await db.update(users).set(patch).where(eq(users.id, v.user.id));
    trackProfileChanges(v.user.id, v.user, patch as Record<string, unknown>, `about_${via}`);
  }
  // Brain event: which question, how answered (never free text; a ZIP is reduced to its first 3 digits).
  track(
    answer ? "about_card_answered" : "about_card_skipped",
    { question: q.id, via, ...(answer ? { answer: q.id === "zip" ? answer.slice(0, 3) : answer } : {}) },
    { userId: v.user?.id, deviceId: v.deviceId },
  );
  return { ok: true, status };
}

/**
 * On sign-in (linkDevice): the browser's card rows move to the account, and answers fill any profile field the
 * account doesn't have yet (an account's own answers always win).
 */
export async function moveDeviceAnswers(userId: string, deviceId: string) {
  const answers = await deviceAnswers(deviceId);
  await db
    .update(profileAnswers)
    .set({ userId, deviceId: null })
    .where(and(eq(profileAnswers.deviceId, deviceId), isNull(profileAnswers.userId)));
  if (!Object.keys(answers).length) return;
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return;
  const patch: Partial<User> = {};
  for (const [q, a] of Object.entries(answers) as [AboutQuestionId, string][]) {
    const f = USER_FIELD[q];
    if (u[f] == null || u[f] === "") (patch as Record<string, unknown>)[f] = a;
  }
  if (answers.zip && !u.zipCode && !u.country) {
    const z = lookupZip(answers.zip, "US");
    if (z.ok) Object.assign(patch, { country: z.country, region: z.region, city: z.city });
  }
  if (Object.keys(patch).length) {
    await db.update(users).set(patch).where(eq(users.id, userId));
    trackProfileChanges(userId, u, patch as Record<string, unknown>, "about_carry_over");
  }
}

/**
 * "People like you" bar for one battle (lib/like-you.ts): votes grouped by the voter's sex and age range (account
 * profile, else the guest's card answers). Real votes only (no seed or flagged votes). Never throws.
 */
export async function likeYouFor(battleId: string, v: Viewer): Promise<LikeYou | null> {
  try {
    const e = await getEconomy();
    const known = await knownAnswers(v);
    const skippedRows =
      v.user || v.deviceId
        ? await db
            .select({ q: profileAnswers.question })
            .from(profileAnswers)
            .where(and(ownerCond(v), eq(profileAnswers.status, "skipped")))
        : [];
    const skipped = { sex: skippedRows.some((r) => r.q === "sex"), age: skippedRows.some((r) => r.q === "age") };
    if (!known.sex && !skipped.sex) return null;
    const rows = await db.execute<LikeYouVote>(sql`
      SELECT v.side, COALESCE(u.sex, da.sex) AS sex, COALESCE(u.age_range, da.age) AS age
      FROM vote v
      LEFT JOIN "user" u ON u.id = v.user_id
      LEFT JOIN LATERAL (
        SELECT max(pa.answer) FILTER (WHERE pa.question = 'sex') AS sex, max(pa.answer) FILTER (WHERE pa.question = 'age') AS age
        FROM profile_answer pa WHERE v.device_id IS NOT NULL AND pa.device_id = v.device_id AND pa.status = 'answered'
      ) da ON true
      WHERE v.battle_id = ${battleId} AND NOT v.flagged AND COALESCE(v.source, '') <> 'seed'`);
    return likeYouView([...rows], { sex: known.sex, age: known.age }, skipped, e.likeYouMinVotes);
  } catch (err) {
    console.error("[about] like you", err);
    return null;
  }
}

/**
 * Everything the one-tap sign-up card (vote 15) can fill in before the person has an account: votes so far, a
 * username in the suggested style, sex and age from their cards, and a ZIP from their card or else the IP guess.
 */
export async function signupPrefill(deviceId: string | null) {
  const a = deviceId ? await deviceAnswers(deviceId) : {};
  const [d] = deviceId ? await db.select().from(devices).where(eq(devices.id, deviceId)) : [];
  const zip = a.zip ?? (d?.ipCountry === "US" && d.ipZip && /^\d{5}$/.test(d.ipZip) ? d.ipZip : null);
  return {
    votes: deviceId ? await voteCount({ user: null, deviceId }) : 0,
    handle: generateHandle(),
    sex: a.sex ?? null,
    ageRange: a.age ?? null,
    zipCode: zip,
    zipFromIp: !a.zip && !!zip,
    place: zipPlace(zip),
  };
}
