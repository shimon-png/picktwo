/**
 * Theme engagement for the Brain (Alex, Nov 24 2026): which battle themes real people vote on, skip, and leave on.
 * Pure: takes rows the service already loaded (Clean / All scope applied) and does all the counting, so it is tested
 * in tests/unit/theme-engagement.test.ts. Words used on the page:
 * - seen: a person × battle that reached the top of the Vote deck (`card_shown`), counted once.
 * - voted: a seen card the same person voted on. Vote rate = voted ÷ seen.
 * - skipped: the deck's Skip button (`skip` table). Skip rate = skipped ÷ seen.
 * - left: seen, never voted or skipped (they closed the app or the tab on it).
 * - votes / voters: every counted vote on that theme from any screen (adds up to the Votes tile).
 * - bounced: a visitor with no account who was active on one New York day only, and that day is over (24h+ ago).
 */
export type Kind = "text" | "photo";
export type BattleMeta = { slug: string; title: string; theme: string; ai: boolean; kind: Kind };
export type SeenRow = { who: string; battleId: string; at: string };
export type VoteRow = { who: string; battleId: string; at: string };
export type SkipRow = { who: string; battleId: string; at: string };
export type Person = { handle: string | null; signedUp: boolean; hasAccount: boolean; activeDays: number; firstSeen: string; lastSeen: string };

export type ThemeStat = {
  theme: string;
  kind?: Kind;
  battles: number;
  aiTagged: number;
  seen: number;
  seenPeople: number;
  voted: number;
  skipped: number;
  left: number;
  votes: number;
  voters: number;
  signupVoters: number;
  bounceLast: number;
  voteRate: number | null;
  skipRate: number | null;
  /** voters ÷ everyone who voted; signupVoters ÷ sign-ups; bounceLast ÷ bounced people who saw a battle. */
  pctVoters: number | null;
  pctSignups: number | null;
  pctBounced: number | null;
  /** Share of all seen cards that were this theme: compare with pctBounced to spot themes people leave on. */
  pctSeen: number | null;
};

export type VoterRow = {
  who: string;
  handle: string | null;
  signedUp: boolean;
  votes: number;
  seen: number;
  skips: number;
  left: number;
  themes: { theme: string; n: number }[];
  skipped: { slug: string; title: string; theme: string }[];
  lastAt: string;
};

export type BounceBattle = { battleId: string; slug: string; title: string; theme: string; kind: Kind; people: number; voted: number; skipped: number; left: number };

export type ThemeEngagement = {
  totals: { seen: number; voted: number; skipped: number; left: number; votes: number; voters: number; signups: number; signupVoters: number; bounced: number; bouncedNoBattle: number; battles: number; aiTagged: number };
  themes: ThemeStat[];
  themeKinds: ThemeStat[];
  voters: VoterRow[];
  bounce: { lastBattles: BounceBattle[]; lastThree: { theme: string; n: number }[]; avgVotesBeforeLeaving: number | null };
};

const key = (who: string, battleId: string) => `${who}\u0000${battleId}`;
const rate = (n: number, d: number) => (d ? n / d : null);

export function themeEngagement(input: {
  battles: Map<string, BattleMeta>;
  seen: SeenRow[];
  votes: VoteRow[];
  skips: SkipRow[];
  people: Map<string, Person>;
  /** Sign-ups tile (accounts that finished sign-up in the window). */
  signups: number;
  now?: number;
}): ThemeEngagement {
  const { battles, people } = input;
  const now = input.now ?? Date.now();
  const meta = (id: string): BattleMeta => battles.get(id) ?? { slug: "", title: "(deleted battle)", theme: "other", ai: false, kind: "text" };

  const voted = new Set(input.votes.map((v) => key(v.who, v.battleId)));
  const skipped = new Set(input.skips.map((s) => key(s.who, s.battleId)));
  // One seen row per person × battle (keep the latest time).
  const seenBy = new Map<string, SeenRow>();
  for (const s of input.seen) {
    const k = key(s.who, s.battleId);
    const prev = seenBy.get(k);
    if (!prev || s.at > prev.at) seenBy.set(k, s);
  }
  const seen = [...seenBy.values()];

  // Bounced: no account, one active day, over 24h ago.
  const bounced = new Set<string>();
  for (const [who, p] of people) {
    if (!p.hasAccount && p.activeDays <= 1 && Date.parse(p.lastSeen) < now - 86400_000) bounced.add(who);
  }

  // Each bounced person's battles in time order (seen, voted or skipped), newest last.
  const trail = new Map<string, { battleId: string; at: string }[]>();
  const touch = (who: string, battleId: string, at: string) => {
    if (!bounced.has(who)) return;
    const t = trail.get(who) ?? [];
    const i = t.findIndex((x) => x.battleId === battleId);
    if (i >= 0) {
      if (at > t[i].at) t[i].at = at;
    } else t.push({ battleId, at });
    trail.set(who, t);
  };
  for (const s of seen) touch(s.who, s.battleId, s.at);
  for (const v of input.votes) touch(v.who, v.battleId, v.at);
  for (const s of input.skips) touch(s.who, s.battleId, s.at);

  const lastOf = new Map<string, string>(); // who → last battle
  const lastBattles = new Map<string, BounceBattle>();
  const lastThree = new Map<string, number>();
  for (const [who, t] of trail) {
    t.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    const last = t[t.length - 1];
    lastOf.set(who, last.battleId);
    const m = meta(last.battleId);
    const row = lastBattles.get(last.battleId) ?? { battleId: last.battleId, slug: m.slug, title: m.title, theme: m.theme, kind: m.kind, people: 0, voted: 0, skipped: 0, left: 0 };
    row.people++;
    const k = key(who, last.battleId);
    if (voted.has(k)) row.voted++;
    else if (skipped.has(k)) row.skipped++;
    else row.left++;
    lastBattles.set(last.battleId, row);
    for (const theme of new Set(t.slice(-3).map((x) => meta(x.battleId).theme))) lastThree.set(theme, (lastThree.get(theme) ?? 0) + 1);
  }
  const bouncedWithBattle = lastOf.size;

  // Theme (and theme × card type) counters.
  type Acc = { battles: Set<string>; seenPeople: Set<string>; voters: Set<string>; signupVoters: Set<string>; seen: number; voted: number; skipped: number; left: number; votes: number; bounceLast: number };
  const blank = (): Acc => ({ battles: new Set(), seenPeople: new Set(), voters: new Set(), signupVoters: new Set(), seen: 0, voted: 0, skipped: 0, left: 0, votes: 0, bounceLast: 0 });
  const byTheme = new Map<string, Acc>();
  const byThemeKind = new Map<string, Acc>();
  const accs = (battleId: string) => {
    const m = meta(battleId);
    const tk = `${m.theme}|${m.kind}`;
    if (!byTheme.has(m.theme)) byTheme.set(m.theme, blank());
    if (!byThemeKind.has(tk)) byThemeKind.set(tk, blank());
    return [byTheme.get(m.theme)!, byThemeKind.get(tk)!];
  };

  for (const s of seen) {
    const k = key(s.who, s.battleId);
    for (const a of accs(s.battleId)) {
      a.battles.add(s.battleId);
      a.seenPeople.add(s.who);
      a.seen++;
      if (voted.has(k)) a.voted++;
      else if (!skipped.has(k)) a.left++;
    }
  }
  // Every skip row counts (so the column adds up to the Skips tile), even one with no logged deck view.
  for (const s of input.skips) {
    for (const a of accs(s.battleId)) {
      a.battles.add(s.battleId);
      a.skipped++;
    }
  }
  for (const v of input.votes) {
    const signed = people.get(v.who)?.signedUp ?? false;
    for (const a of accs(v.battleId)) {
      a.battles.add(v.battleId);
      a.votes++;
      a.voters.add(v.who);
      if (signed) a.signupVoters.add(v.who);
    }
  }
  for (const [, battleId] of lastOf) for (const a of accs(battleId)) a.bounceLast++;

  const allVoters = new Set(input.votes.map((v) => v.who));
  const signupVoters = [...allVoters].filter((w) => people.get(w)?.signedUp).length;
  const seenTotal = seen.length;
  const finish = (theme: string, a: Acc, kind?: Kind): ThemeStat => ({
    theme,
    ...(kind ? { kind } : {}),
    battles: a.battles.size,
    aiTagged: [...a.battles].filter((id) => battles.get(id)?.ai).length,
    seen: a.seen,
    seenPeople: a.seenPeople.size,
    voted: a.voted,
    skipped: a.skipped,
    left: a.left,
    votes: a.votes,
    voters: a.voters.size,
    signupVoters: a.signupVoters.size,
    bounceLast: a.bounceLast,
    voteRate: rate(a.voted, a.seen),
    skipRate: rate(a.skipped, a.seen),
    pctVoters: rate(a.voters.size, allVoters.size),
    pctSignups: rate(a.signupVoters.size, input.signups),
    pctBounced: rate(a.bounceLast, bouncedWithBattle),
    pctSeen: rate(a.seen, seenTotal),
  });
  const order = (x: ThemeStat, y: ThemeStat) => y.votes - x.votes || y.seen - x.seen || x.theme.localeCompare(y.theme);
  const themes = [...byTheme.entries()].map(([t, a]) => finish(t, a)).sort(order);
  const themeKinds = [...byThemeKind.entries()].map(([tk, a]) => {
    const [t, k] = tk.split("|");
    return finish(t, a, k as Kind);
  }).sort(order);

  // One row per real voter.
  const vr = new Map<string, VoterRow & { themeMap: Map<string, number> }>();
  const row = (who: string) => {
    let r = vr.get(who);
    if (!r) {
      const p = people.get(who);
      r = { who, handle: p?.handle ?? null, signedUp: p?.signedUp ?? false, votes: 0, seen: 0, skips: 0, left: 0, themes: [], skipped: [], lastAt: "", themeMap: new Map() };
      vr.set(who, r);
    }
    return r;
  };
  for (const v of input.votes) {
    const r = row(v.who);
    r.votes++;
    const t = meta(v.battleId).theme;
    r.themeMap.set(t, (r.themeMap.get(t) ?? 0) + 1);
    if (v.at > r.lastAt) r.lastAt = v.at;
  }
  for (const s of seen) {
    const r = vr.get(s.who);
    if (!r) continue; // voters only
    r.seen++;
    const k = key(s.who, s.battleId);
    if (!voted.has(k) && !skipped.has(k)) r.left++;
  }
  for (const s of input.skips) {
    const r = vr.get(s.who);
    if (!r) continue;
    r.skips++;
    const m = meta(s.battleId);
    r.skipped.push({ slug: m.slug, title: m.title, theme: m.theme });
  }
  const voters = [...vr.values()]
    .map(({ themeMap, ...r }) => ({ ...r, themes: [...themeMap.entries()].map(([theme, n]) => ({ theme, n })).sort((a, b) => b.n - a.n || a.theme.localeCompare(b.theme)) }))
    .sort((a, b) => b.votes - a.votes || (a.lastAt < b.lastAt ? 1 : -1));

  // Votes cast by bounced people before they left.
  const bouncedVotes = input.votes.filter((v) => bounced.has(v.who)).length;

  return {
    totals: {
      seen: seenTotal,
      voted: seen.filter((s) => voted.has(key(s.who, s.battleId))).length,
      skipped: input.skips.length,
      left: seen.filter((s) => !voted.has(key(s.who, s.battleId)) && !skipped.has(key(s.who, s.battleId))).length,
      votes: input.votes.length,
      voters: allVoters.size,
      signups: input.signups,
      signupVoters,
      bounced: bounced.size,
      bouncedNoBattle: bounced.size - bouncedWithBattle,
      battles: new Set([...seen.map((s) => s.battleId), ...input.votes.map((v) => v.battleId), ...input.skips.map((s) => s.battleId)]).size,
      aiTagged: new Set([...seen.map((s) => s.battleId), ...input.votes.map((v) => v.battleId)].filter((id) => battles.get(id)?.ai)).size,
    },
    themes,
    themeKinds,
    voters,
    bounce: {
      lastBattles: [...lastBattles.values()].sort((a, b) => b.people - a.people || a.title.localeCompare(b.title)),
      lastThree: [...lastThree.entries()].map(([theme, n]) => ({ theme, n })).sort((a, b) => b.n - a.n),
      avgVotesBeforeLeaving: bounced.size ? bouncedVotes / bounced.size : null,
    },
  };
}

/** Plain-language headlines for the top of the theme table. Rates only for themes with enough cards to mean something. */
export function themeHighlights(te: ThemeEngagement, label: (t: string) => string, minSeen = 20, minBounces = 5): string[] {
  const out: string[] = [];
  const p = (x: number | null) => `${Math.round(100 * (x ?? 0))}%`;
  const enough = te.themes.filter((t) => t.seen >= minSeen && t.voteRate != null);
  const top = te.themes[0];
  if (top && top.votes > 0) out.push(`Most votes: ${label(top.theme)} (${top.votes} votes; ${p(top.pctVoters)} of voters voted on at least one).`);
  if (enough.length >= 2) {
    const byRate = [...enough].sort((a, b) => b.voteRate! - a.voteRate!);
    const best = byRate[0];
    const worst = byRate[byRate.length - 1];
    out.push(`Best vote rate: ${label(best.theme)} (${p(best.voteRate)} of ${best.seen} cards seen). Lowest: ${label(worst.theme)} (${p(worst.voteRate)} of ${worst.seen}).`);
    const bySkip = [...enough].sort((a, b) => b.skipRate! - a.skipRate!);
    if (bySkip[0].skipped > 0) out.push(`Most skipped: ${label(bySkip[0].theme)} (${p(bySkip[0].skipRate)} skip rate, ${bySkip[0].skipped} skips).`);
  } else if (te.totals.seen) out.push(`Not enough deck views yet to compare vote rates (needs ${minSeen}+ cards seen per theme).`);
  if (te.totals.skipped === 0 && te.totals.seen > 0) out.push("Nobody pressed Skip in this window; people who don't want a card just close the app on it (Left on it).");
  const bouncy = te.themes
    .filter((t) => t.bounceLast >= minBounces && t.pctSeen && t.pctBounced != null)
    .map((t) => ({ t, index: t.pctBounced! / t.pctSeen! }))
    .sort((a, b) => b.index - a.index);
  if (bouncy.length && bouncy[0].index > 1.2)
    out.push(`Bounce theme: ${label(bouncy[0].t.theme)} is the last card for ${p(bouncy[0].t.pctBounced)} of bounced visitors but only ${p(bouncy[0].t.pctSeen)} of cards seen (${bouncy[0].index.toFixed(1)}×).`);
  return out;
}
