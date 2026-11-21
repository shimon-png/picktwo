import { and, desc, eq, inArray, isNotNull, lt, sql, notInArray, or } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import {
  battles,
  options,
  outcomes,
  users,
  votes,
  reasonHelpful,
  follows,
  type Battle,
  type User,
} from "../db/schema";
import { AppError } from "../errors";
import { createSlug } from "@/lib/id";
import { DEFAULT_CATEGORY_ID, REASON_CHIPS, kidAgeLabel } from "@/lib/constants";
import type { CreateBattleInput } from "@/lib/validators";
import { assertCleanText, hashMatchImage, screenImage } from "../moderation";
import { strictest } from "./safety";
import { recordAutoHold, recordHashMatch } from "./reports";
import { del } from "@vercel/blob";
import { awardPoints, countOpenLoops } from "./points";
import { getConfig, getEconomy } from "./config";
import { notify } from "./notifications";
import { track } from "../analytics";
import { pct } from "@/lib/utils";
import { isAdmin } from "../viewer";

// ---------------- Create ----------------
/**
 * Admin "post as": resolve the username to a user, creating a profile for it if it doesn't exist.
 * Created profiles have no email, so nobody can sign in as them.
 */
async function resolvePostAs(handle: string): Promise<User> {
  const [existing] = await db.select().from(users).where(eq(users.handle, handle));
  if (existing) {
    if (existing.bannedAt) throw new AppError("FORBIDDEN", `@${handle} is banned`);
    return existing;
  }
  const [created] = await db
    .insert(users)
    .values({ handle, name: handle, isAdultConfirmed: true, onboardedAt: new Date() })
    .onConflictDoNothing({ target: users.handle })
    .returning();
  if (created) return created;
  const [raced] = await db.select().from(users).where(eq(users.handle, handle));
  return raced;
}

export async function createBattle(actor: User, input: CreateBattleInput, opts: { asAdmin?: boolean } = {}) {
  if (!actor.isAdultConfirmed || !actor.handle) throw new AppError("FORBIDDEN", "Finish setting up your profile first");
  if (input.postAs && !opts.asAdmin) throw new AppError("FORBIDDEN", "Only admins can post as another user");
  assertCleanText(input.title, input.context, input.options[0].label, input.options[1].label, input.postAs);
  const user = input.postAs && input.postAs !== actor.handle ? await resolvePostAs(input.postAs) : actor;
  const screen = await screenPhotos(user, input.options);
  const economy = await getEconomy();
  const deadline = new Date(Date.now() + input.deadlineHours * 3600_000);

  const result = await db.transaction(async (tx) => {
    let slug = createSlug();
    for (let i = 0; i < 3; i++) {
      const [exists] = await tx.select({ id: battles.id }).from(battles).where(eq(battles.slug, slug));
      if (!exists) break;
      slug = createSlug();
    }
    const [b] = await tx
      .insert(battles)
      .values({
        slug,
        authorId: user.id,
        title: input.title,
        context: input.context || null,
        categoryId: DEFAULT_CATEGORY_ID,
        tags: input.tags,
        visibility: input.visibility,
        status: screen.verdict === "review" ? "HIDDEN" : "OPEN",
        deadline,
        dataConsent: input.dataConsent && user.dataConsent,
      })
      .returning();
    await tx.insert(options).values(
      input.options.map((o, i) => ({
        battleId: b.id,
        side: (i === 0 ? "A" : "B") as "A" | "B",
        label: o.label,
        description: o.description || null,
        imageUrl: o.imageUrl || null,
        url: o.url || null,
        urlTitle: o.urlTitle || null,
        urlImage: o.urlImage || null,
        priceCents: o.priceCents ?? null,
        currency: o.currency ?? null,
      })),
    );
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(battles)
      .where(eq(battles.authorId, user.id));
    let bonus = 0;
    if (n === 1) bonus = await awardPoints(tx, user.id, economy.firstBattleBonus, "FIRST_BATTLE", { battleId: b.id, idemKey: `first:${user.id}` });
    await tx.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));
    return { battle: b, bonus };
  });
  track(
    "battle_published",
    { visibility: input.visibility, hours: input.deadlineHours, ...(user.id !== actor.id ? { postedBy: actor.id } : {}) },
    { userId: user.id },
  );
  if (screen.verdict === "review") await recordAutoHold(result.battle.id, result.battle.title, result.battle.slug, screen.reasons);
  const openLoops = await countOpenLoops(user.id, economy);
  return { inReview: screen.verdict === "review", slug: result.battle.slug, bonus: user.id === actor.id ? result.bonus : 0, openLoops, postedAs: user.id === actor.id ? null : user.handle };
}

/**
 * Screen every photo before a battle goes public: known-CSAM hash match first (bans + records for
 * NCMEC reporting), then the explicit-content classifier. Blocked uploads are refused (and removed
 * from Blob); uncertain ones return "review" so the battle is created hidden for an admin.
 */
async function screenPhotos(user: User, opts: CreateBattleInput["options"]) {
  const urls = opts.flatMap((o) => [o.imageUrl, o.urlImage]).filter((u): u is string => !!u && (u.startsWith("https://") || u.startsWith("data:image/")));
  if (!urls.length) return { verdict: "allow" as const, reasons: [] as string[] };
  const hashes = await Promise.all(urls.map((u) => hashMatchImage(u)));
  const matched = urls.filter((_, i) => hashes[i].match);
  if (matched.length) {
    await recordHashMatch(user.id, matched);
    track("upload_hash_match", {}, { userId: user.id });
    throw new AppError("FORBIDDEN", "This upload violates our policies and can't be posted.");
  }
  const { features } = await getConfig();
  const decision = strictest(await Promise.all(urls.map((u) => screenImage(u, { requireModeration: features.requireImageModeration }))));
  const hashError = hashes.find((h) => h.error)?.error;
  if (hashError && decision.verdict === "allow") return { verdict: "review" as const, reasons: [`hash check unavailable: ${hashError}`] };
  if (decision.verdict === "block") {
    track("upload_blocked", { reasons: decision.reasons }, { userId: user.id });
    const own = opts.map((o) => o.imageUrl).filter((u): u is string => !!u && u.includes(".blob.vercel-storage.com/"));
    if (own.length && process.env.BLOB_READ_WRITE_TOKEN) await del(own).catch(() => {});
    throw new AppError("VALIDATION", "One of your photos looks explicit or graphic, so it can't be posted. Please choose another.");
  }
  return decision;
}

// ---------------- Close (lazy + cron) ----------------
/** Closes a battle if it is open and past deadline. Idempotent. Returns true if this call closed it. */
export async function closeIfDue(tx: DbOrTx, battleId: string, now = new Date()): Promise<boolean> {
  const closed = await tx
    .update(battles)
    .set({ status: "CLOSED", closedAt: now, updatedAt: now })
    .where(and(eq(battles.id, battleId), eq(battles.status, "OPEN"), lt(battles.deadline, now)))
    .returning({ id: battles.id, authorId: battles.authorId, slug: battles.slug, title: battles.title, votesA: battles.votesA, votesB: battles.votesB });
  if (closed.length === 0) return false;
  const b = closed[0];
  await notify(tx, b.authorId, "BATTLE_CLOSED", { slug: b.slug, title: b.title, votes: b.votesA + b.votesB });
  return true;
}

export async function closeDueBattles(now = new Date()) {
  const due = await db
    .select({ id: battles.id })
    .from(battles)
    .where(and(eq(battles.status, "OPEN"), lt(battles.deadline, now)))
    .limit(500);
  let n = 0;
  for (const b of due) if (await closeIfDue(db, b.id, now)) n++;
  // Expire finished boosts
  await db
    .update(battles)
    .set({ boostUntil: null, boostVotesLeft: 0 })
    .where(and(isNotNull(battles.boostUntil), or(lt(battles.boostUntil, now), sql`${battles.boostVotesLeft} <= 0`)));
  return n;
}

// ---------------- Read ----------------
export async function getBattleRow(slug: string) {
  const [b] = await db.select().from(battles).where(eq(battles.slug, slug));
  if (!b || b.status === "DELETED") return null;
  if (b.status === "OPEN" && b.deadline < new Date()) {
    await closeIfDue(db, b.id);
    b.status = "CLOSED";
    b.closedAt = new Date();
  }
  return b;
}

export async function areFriends(a: string, b: string) {
  if (a === b) return true;
  const rows = await db
    .select()
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, a), eq(follows.followingId, b)),
        and(eq(follows.followerId, b), eq(follows.followingId, a)),
      ),
    );
  return rows.length === 2;
}

export async function friendIds(userId: string): Promise<Set<string>> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT f1.following_id AS id FROM follow f1
    JOIN follow f2 ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
    WHERE f1.follower_id = ${userId}`);
  return new Set(rows.map((r) => r.id));
}

export async function assertCanView(b: Battle, viewer: User | null) {
  if (b.status === "HIDDEN" && viewer?.id !== b.authorId && !isAdmin(viewer)) throw new AppError("NOT_FOUND", "This battle isn't available");
  if (b.visibility === "FRIENDS") {
    if (!viewer) throw new AppError("UNAUTHORIZED", "Sign in to see this battle — it's shared with friends only");
    if (!(await areFriends(viewer.id, b.authorId))) throw new AppError("FORBIDDEN", "This battle is shared with friends only");
  }
}

export type ReasonView = {
  voteId: string;
  side: "A" | "B";
  text: string;
  by: string;
  byHandle: string | null;
  helpful: number;
  ownerHelpful: boolean;
  markedByMe: boolean;
  mine: boolean;
};

export type BattleView = Awaited<ReturnType<typeof getBattleView>>;

export async function getBattleView(slug: string, viewer: { user: User | null; deviceId: string | null }) {
  const b = await getBattleRow(slug);
  if (!b) return null;
  await assertCanView(b, viewer.user);

  const [opts, [author], [outcome]] = await Promise.all([
    db.select().from(options).where(eq(options.battleId, b.id)),
    db.select({ id: users.id, name: users.name, handle: users.handle, image: users.image }).from(users).where(eq(users.id, b.authorId)),
    db.select().from(outcomes).where(eq(outcomes.battleId, b.id)),
  ]);
  const A = opts.find((o) => o.side === "A")!;
  const B = opts.find((o) => o.side === "B")!;

  let myVote: { id: string; side: "A" | "B"; reason: string | null } | null = null;
  if (viewer.user || viewer.deviceId) {
    const cond = viewer.user
      ? or(eq(votes.userId, viewer.user.id), viewer.deviceId ? eq(votes.deviceId, viewer.deviceId) : sql`false`)
      : eq(votes.deviceId, viewer.deviceId!);
    const [v] = await db
      .select({ id: votes.id, side: votes.side, reason: votes.reason })
      .from(votes)
      .where(and(eq(votes.battleId, b.id), cond));
    if (v) myVote = v;
  }

  const isOwner = viewer.user?.id === b.authorId;
  const isOpen = b.status === "OPEN";
  const showResults = isOwner || !!myVote || !isOpen;
  const results = showResults ? pct(b.votesA, b.votesB) : null;

  let reasons: { A: ReasonView[]; B: ReasonView[] } = { A: [], B: [] };
  if (showResults) reasons = await getReasons(b, viewer.user);

  const economy = await getEconomy();
  const totalVotes = b.votesA + b.votesB;
  const now = new Date();

  // Voter relevance (owner view): how many votes came from parents of same-age kids.
  let relevantVotes: { count: number; ageLabel: string } | null = null;
  const ageTags = b.tags?.kidAge ?? [];
  if (isOwner && ageTags.length && totalVotes > 0) {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(votes)
      .innerJoin(users, eq(users.id, votes.userId))
      .where(and(eq(votes.battleId, b.id), sql`${users.kidAges} && ARRAY[${sql.join(ageTags.map((a) => sql`${a}`), sql`, `)}]::text[]`));
    relevantVotes = { count: r?.n ?? 0, ageLabel: ageTags.map(kidAgeLabel).join(", ") };
  }

  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    context: b.context,
    tags: b.tags,
    visibility: b.visibility,
    status: b.status,
    isOpen,
    deadline: b.deadline.toISOString(),
    createdAt: b.createdAt.toISOString(),
    author,
    options: { A, B },
    results,
    totalVotes: showResults ? totalVotes : null,
    myVote,
    isOwner,
    reasons,
    outcome: outcome
      ? { chosen: outcome.chosen, thumb: outcome.thumb, note: outcome.note, photoUrl: outcome.photoUrl, reportedAt: outcome.reportedAt.toISOString() }
      : null,
    boostActive: !!b.boostUntil && b.boostUntil > now && b.boostVotesLeft > 0,
    canEdit: isOwner && totalVotes === 0 && isOpen,
    canReportOutcome: isOwner && (!isOpen || totalVotes >= economy.minVotesForLoop),
    loopEligible: totalVotes >= economy.minVotesForLoop,
    minVotesForLoop: economy.minVotesForLoop,
    boostCost: economy.boostCost,
    viewerPP: viewer.user?.ppBalance ?? null,
    relevantVotes,
    reasonSuggestions: REASON_CHIPS,
    loopRewards: {
      loop: economy.loopClosedPoints,
      fast: economy.loopClosedFastBonus,
      fastHours: economy.loopClosedFastHours,
      note: economy.outcomeNotePoints,
      noteMin: economy.outcomeNoteMinChars,
    },
  };
}

async function getReasons(b: Battle, viewer: User | null) {
  const rows = await db
    .select({
      voteId: votes.id,
      side: votes.side,
      text: votes.reason,
      userId: votes.userId,
      name: users.name,
      handle: users.handle,
      kidAges: users.kidAges,
      helpful: sql<number>`(SELECT count(*)::int FROM reason_helpful rh WHERE rh.vote_id = ${votes.id})`,
      ownerHelpful: sql<boolean>`EXISTS(SELECT 1 FROM reason_helpful rh WHERE rh.vote_id = ${votes.id} AND rh.is_owner)`,
    })
    .from(votes)
    .leftJoin(users, eq(users.id, votes.userId))
    .where(and(eq(votes.battleId, b.id), isNotNull(votes.reason), eq(votes.reasonHidden, false)))
    .limit(200);

  let mine = new Set<string>();
  let friends = new Set<string>();
  if (viewer) {
    const ids = rows.map((r) => r.voteId);
    if (ids.length) {
      const m = await db
        .select({ voteId: reasonHelpful.voteId })
        .from(reasonHelpful)
        .where(and(eq(reasonHelpful.userId, viewer.id), inArray(reasonHelpful.voteId, ids)));
      mine = new Set(m.map((x) => x.voteId));
    }
    friends = await friendIds(viewer.id);
  }

  const out: { A: ReasonView[]; B: ReasonView[] } = { A: [], B: [] };
  for (const r of rows) {
    if (!r.text) continue;
    const isFriend = !!r.userId && (friends.has(r.userId) || r.userId === viewer?.id);
    const by = isFriend
      ? r.name || `@${r.handle}`
      : r.kidAges && r.kidAges.length
        ? `A parent of a ${kidAgeLabel(r.kidAges[0])} y/o`
        : r.userId
          ? "A crowdpick voter"
          : "A guest";
    out[r.side].push({
      voteId: r.voteId,
      side: r.side,
      text: r.text,
      by,
      byHandle: isFriend ? r.handle : null,
      helpful: r.helpful,
      ownerHelpful: r.ownerHelpful,
      markedByMe: mine.has(r.voteId),
      mine: !!viewer && r.userId === viewer.id,
    });
  }
  const score = (r: ReasonView) => r.helpful + (r.ownerHelpful ? 2 : 0);
  out.A.sort((x, y) => score(y) - score(x));
  out.B.sort((x, y) => score(y) - score(x));
  return out;
}

// ---------------- Owner actions ----------------
export async function getOwnedBattle(slug: string, user: User) {
  const b = await getBattleRow(slug);
  if (!b) throw new AppError("NOT_FOUND", "Battle not found");
  if (b.authorId !== user.id) throw new AppError("FORBIDDEN", "Only the poster can do that");
  return b;
}

export async function editBattle(slug: string, user: User, patch: { title?: string; context?: string }) {
  const b = await getOwnedBattle(slug, user);
  if (b.votesA + b.votesB > 0) throw new AppError("CONFLICT", "You can't edit after the first vote");
  assertCleanText(patch.title, patch.context);
  await db
    .update(battles)
    .set({ title: patch.title ?? b.title, context: patch.context ?? b.context, updatedAt: new Date() })
    .where(eq(battles.id, b.id));
}

export async function closeEarly(slug: string, user: User) {
  const b = await getOwnedBattle(slug, user);
  if (b.status !== "OPEN") return;
  const now = new Date();
  await db.update(battles).set({ deadline: now, status: "CLOSED", closedAt: now, updatedAt: now }).where(eq(battles.id, b.id));
}

export async function extendDeadline(slug: string, user: User, hours: number) {
  const b = await getOwnedBattle(slug, user);
  if (b.status !== "OPEN") throw new AppError("VOTING_CLOSED", "Voting has already closed");
  const h = Math.min(Math.max(1, hours), 168);
  await db
    .update(battles)
    .set({ deadline: new Date(b.deadline.getTime() + h * 3600_000), updatedAt: new Date() })
    .where(eq(battles.id, b.id));
}

export async function deleteBattle(slug: string, user: User, asAdmin = false) {
  const b = await getBattleRow(slug);
  if (!b) throw new AppError("NOT_FOUND", "Battle not found");
  if (!asAdmin && b.authorId !== user.id) throw new AppError("FORBIDDEN", "Only the poster can delete this");
  await db.update(battles).set({ status: "DELETED", updatedAt: new Date() }).where(eq(battles.id, b.id));
}

export async function boostBattle(slug: string, user: User) {
  const b = await getOwnedBattle(slug, user);
  if (b.status !== "OPEN") throw new AppError("VOTING_CLOSED", "You can only boost an open battle");
  if (b.boostUntil) throw new AppError("CONFLICT", "This battle has already been boosted");
  const economy = await getEconomy();
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ pp: users.ppBalance }).from(users).where(eq(users.id, user.id)).for("update");
    if (!u || u.pp < economy.boostCost) throw new AppError("INSUFFICIENT_POINTS", `You need ${economy.boostCost} ⚡ to boost`);
    await awardPoints(tx, user.id, -economy.boostCost, "BOOST", { battleId: b.id, idemKey: `boost:${b.id}` });
    await tx
      .update(battles)
      .set({ boostUntil: new Date(Date.now() + economy.boostHours * 3600_000), boostVotesLeft: economy.boostVotes })
      .where(eq(battles.id, b.id));
    track("boost_used", { battleId: b.id }, { userId: user.id });
    return { ppBalance: u.pp - economy.boostCost };
  });
}

// ---------------- Lists ----------------
export type BattleCard = {
  id: string;
  slug: string;
  title: string;
  context: string | null;
  categoryId: string;
  deadline: string;
  status: string;
  votesA: number;
  votesB: number;
  createdAt: string;
  labelA: string;
  labelB: string;
  descA: string | null;
  descB: string | null;
  imageA: string | null;
  imageB: string | null;
  authorHandle: string | null;
  authorName: string | null;
  authorImage: string | null;
  authorKidAges: string[];
  kidAgeTags: string[];
  outcome: { chosen: string; thumb: string | null; note: string | null } | null;
};

export async function battleCards(where: ReturnType<typeof and>, limit = 20): Promise<BattleCard[]> {
  const rows = await db
    .select({
      b: battles,
      authorHandle: users.handle,
      authorName: users.name,
      authorImage: users.image,
      authorKidAges: users.kidAges,
      oChosen: outcomes.chosen,
      oThumb: outcomes.thumb,
      oNote: outcomes.note,
    })
    .from(battles)
    .innerJoin(users, eq(users.id, battles.authorId))
    .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
    .where(where)
    .orderBy(desc(battles.createdAt))
    .limit(limit);
  return hydrateCards(rows);
}

export async function hydrateCards(
  rows: {
    b: Battle;
    authorHandle: string | null;
    authorName: string | null;
    authorImage?: string | null;
    authorKidAges?: string[] | null;
    oChosen: string | null;
    oThumb: string | null;
    oNote: string | null;
  }[],
): Promise<BattleCard[]> {
  const ids = rows.map((r) => r.b.id);
  const opts = ids.length ? await db.select().from(options).where(inArray(options.battleId, ids)) : [];
  return rows.map(({ b, authorHandle, authorName, authorImage, authorKidAges, oChosen, oThumb, oNote }) => {
    const A = opts.find((o) => o.battleId === b.id && o.side === "A");
    const B = opts.find((o) => o.battleId === b.id && o.side === "B");
    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      context: b.context,
      categoryId: b.categoryId,
      deadline: b.deadline.toISOString(),
      status: b.status === "OPEN" && b.deadline < new Date() ? "CLOSED" : b.status,
      votesA: b.votesA,
      votesB: b.votesB,
      createdAt: b.createdAt.toISOString(),
      labelA: A?.label ?? "A",
      labelB: B?.label ?? "B",
      descA: A?.description ?? null,
      descB: B?.description ?? null,
      imageA: A?.imageUrl || A?.urlImage || null,
      imageB: B?.imageUrl || B?.urlImage || null,
      authorHandle,
      authorName,
      authorImage: authorImage ?? null,
      authorKidAges: authorKidAges ?? [],
      kidAgeTags: b.tags?.kidAge ?? [],
      outcome: oChosen ? { chosen: oChosen, thumb: oThumb, note: oNote } : null,
    };
  });
}

export const visibleStatuses = notInArray(battles.status, ["DELETED", "HIDDEN"]);
