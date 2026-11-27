/**
 * Taste profile (About-you plan §4, Nov 25 2026): six two-pole axes scored from what someone picked on AI-tagged
 * battles (battle.tags.brain.a / .b, lib/brain-tags.ts). A pick "votes for" the traits of the side chosen and
 * "against" the traits of the side passed on. Pure; tested in tests/unit/taste-profile.test.ts.
 */

export const TASTE_AXES = [
  { id: "romantic", left: "Romantic", right: "Practical", pos: ["romantic"], neg: ["practical"] },
  { id: "adventurous", left: "Adventurous", right: "Cautious", pos: ["adventurous", "risk_taking"], neg: ["cautious"] },
  { id: "spender", left: "Spender", right: "Saver", pos: ["premium_taste"], neg: ["budget_conscious"] },
  { id: "trendy", left: "Trendy", right: "Classic", pos: ["trendy"], neg: ["classic_style", "traditional"] },
  { id: "forgiving", left: "Forgiving", right: "Strict", pos: ["forgiving"], neg: ["strict"] },
  { id: "direct", left: "Direct", right: "Diplomatic", pos: ["direct"], neg: ["diplomatic"] },
] as const;
export type TasteAxisId = (typeof TASTE_AXES)[number]["id"];

/** Below this many battles that carried an axis, its score is pulled toward 0 (score = sum ÷ max(n, this)). */
export const TASTE_SMOOTH_N = 5;

export type TastePick = { chosen: string[]; other: string[] };
export type AxisScore = {
  id: TasteAxisId;
  left: string;
  right: string;
  /** −1 (fully right pole) … +1 (fully left pole). */
  score: number;
  /** Battles that carried this axis. */
  n: number;
  /** Of those, picks that leaned to the left pole. */
  leftPicks: number;
};

/** Score every axis from a person's picks. */
export function scoreAxes(picks: TastePick[]): AxisScore[] {
  return TASTE_AXES.map((ax) => {
    let sum = 0;
    let n = 0;
    let leftPicks = 0;
    for (const p of picks) {
      const has = (side: string[], list: readonly string[]) => side.some((t) => list.includes(t));
      const toLeft = has(p.chosen, ax.pos) || has(p.other, ax.neg);
      const toRight = has(p.chosen, ax.neg) || has(p.other, ax.pos);
      if (!toLeft && !toRight) continue;
      n++;
      if (toLeft && !toRight) {
        sum++;
        leftPicks++;
      } else if (toRight && !toLeft) sum--;
    }
    return { id: ax.id, left: ax.left, right: ax.right, score: n ? sum / Math.max(n, TASTE_SMOOTH_N) : 0, n, leftPicks };
  });
}

/**
 * Which axes to show (Alex, Nov 27 2026: never show a meaningless wheel). An axis is "measured" once `min` battles
 * tested it (economy tasteAxisMin). Nothing before `firstAt` votes or before two axes are measured; then the measured
 * ones; all six only from `fullAt` votes once every axis is measured. Returns the visible axes in wheel order.
 */
export function visibleAxes(axes: AxisScore[], votes: number, firstAt: number, fullAt: number, min = 3): AxisScore[] {
  const stage = tasteStage(axes, votes, firstAt, fullAt, min);
  if (stage === 0) return [];
  const m = effectiveMin(votes, fullAt, min);
  return stage === 2 ? axes : axes.filter((a) => a.n >= m);
}

/**
 * The promise is "30 battles fill in your chart" (Alex, Nov 27 2026). The deck sends trait-testing battles first so
 * each trait normally has `min` battles by then; from `fullAt` votes one battle is enough, so the chart is never held
 * back past 30 by a trait the deck couldn't find battles for.
 */
export function effectiveMin(votes: number, fullAt: number, min = 3): number {
  return votes >= fullAt ? Math.min(min, 1) : min;
}

/** 0 = nothing to show yet, 1 = some traits measured, 2 = full profile (all six measured, `fullAt` votes). */
export function tasteStage(axes: AxisScore[], votes: number, firstAt: number, fullAt: number, min = 3): 0 | 1 | 2 {
  const measured = axes.filter((a) => a.n >= effectiveMin(votes, fullAt, min)).length;
  if (votes >= fullAt && measured >= axes.length) return 2;
  return votes >= firstAt && measured >= 2 ? 1 : 0;
}

/** Axes not measured yet (fewer than `min` battles tested them), for "still learning" copy and the deck's gap boost. */
export function missingAxes(axes: AxisScore[], min = 3): TasteAxisId[] {
  return axes.filter((a) => a.n < min).map((a) => a.id);
}

/**
 * One pick from a battle's AI tags. `axes` (tags v2) says per axis which option leans to the left pole; it's turned
 * into that axis's pole traits so it scores like the trait lists. Older tags only have the trait lists.
 */
export function pickFromTags(side: "A" | "B", ta: string[] | null, tb: string[] | null, axes?: Record<string, string> | null): TastePick {
  const a = [...(ta ?? [])];
  const b = [...(tb ?? [])];
  for (const ax of TASTE_AXES) {
    const v = axes?.[ax.id];
    if (v === "a") {
      a.push(ax.pos[0]);
      b.push(ax.neg[0]);
    } else if (v === "b") {
      b.push(ax.pos[0]);
      a.push(ax.neg[0]);
    }
  }
  const dedupe = (x: string[]) => [...new Set(x)];
  return side === "A" ? { chosen: dedupe(a), other: dedupe(b) } : { chosen: dedupe(b), other: dedupe(a) };
}

/** Axes a battle tests (from its tags), for the deck's gap boost. */
export function battleAxes(ta: string[] | null | undefined, tb: string[] | null | undefined, axes?: Record<string, string> | null): TasteAxisId[] {
  const all = [...(ta ?? []), ...(tb ?? [])];
  return TASTE_AXES.filter((ax) => axes?.[ax.id] === "a" || axes?.[ax.id] === "b" || all.some((t) => (ax.pos as readonly string[]).includes(t) || (ax.neg as readonly string[]).includes(t))).map((ax) => ax.id);
}

/** Hand-written words for each pole: adjective when it's the strongest lean, noun when it's the second. */
const POLE_WORDS: Record<string, { adj: string; noun: string }> = {
  Romantic: { adj: "Romantic", noun: "romantic" },
  Practical: { adj: "Practical", noun: "pragmatist" },
  Adventurous: { adj: "Adventurous", noun: "adventurer" },
  Cautious: { adj: "Careful", noun: "planner" },
  Spender: { adj: "Lavish", noun: "splurger" },
  Saver: { adj: "Thrifty", noun: "saver" },
  Trendy: { adj: "Trendy", noun: "trendsetter" },
  Classic: { adj: "Timeless", noun: "classicist" },
  Forgiving: { adj: "Big-hearted", noun: "softie" },
  Strict: { adj: "Principled", noun: "rule-keeper" },
  Direct: { adj: "Straight-talking", noun: "realist" },
  Diplomatic: { adj: "Diplomatic", noun: "peacemaker" },
};

/** The pole an axis leans to ("Romantic" for +, "Practical" for −), or null when it's balanced. */
export function lean(a: AxisScore, threshold = 0.15): string | null {
  if (a.n === 0 || Math.abs(a.score) < threshold) return null;
  return a.score > 0 ? a.left : a.right;
}

/** "Careful splurger": the strongest lean's adjective + the second's noun. Needs two clear leans. */
export function typeName(axes: AxisScore[]): string | null {
  const leans = [...axes]
    .map((a) => ({ a, pole: lean(a) }))
    .filter((x): x is { a: AxisScore; pole: string } => !!x.pole)
    .sort((x, y) => Math.abs(y.a.score) - Math.abs(x.a.score));
  if (leans.length < 2) return leans.length === 1 ? `${POLE_WORDS[leans[0].pole].adj} at heart` : null;
  return `${POLE_WORDS[leans[0].pole].adj} ${POLE_WORDS[leans[1].pole].noun}`;
}

/** A plain "why" made from their own picks. */
export function axisWhy(a: AxisScore): string {
  if (a.n === 0) return "No battles have tested this yet.";
  const pole = lean(a);
  const leftShare = a.leftPicks / a.n;
  if (!pole) return `You split it down the middle across ${a.n} battle${a.n === 1 ? "" : "s"} that tested this.`;
  const k = pole === a.left ? a.leftPicks : a.n - a.leftPicks;
  return `You leaned ${pole.toLowerCase()} on ${k} of ${a.n} battle${a.n === 1 ? "" : "s"} that tested this${leftShare > 0.8 || leftShare < 0.2 ? ", more than most people" : ""}.`;
}

/** Radar points (SVG coords) for scores on a wheel of radius r centred at (cx, cy); 0 → mid ring. `curve` off = linear (grid rings). */
export function radarPoints(scores: number[], cx = 100, cy = 100, r = 80, curve = true): [number, number][] {
  return scores.map((s, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / scores.length;
    // Square-root curve so real but modest leans (±0.2–0.4) visibly move off the middle ring.
    const c = Math.max(-1, Math.min(1, s));
    const d = r * (0.5 + 0.5 * (curve ? Math.sign(c) * Math.sqrt(Math.abs(c)) : c));
    return [Math.round((cx + d * Math.cos(angle)) * 10) / 10, Math.round((cy + d * Math.sin(angle)) * 10) / 10];
  });
}
