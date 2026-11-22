/**
 * "You're on a roll" milestones in the Vote deck (Alex, Nov 22 2026): after the 10th and
 * 15th pick, then every 20 more (35, 55, 75…). Counted per browser tab session.
 */
export function isRollMilestone(n: number): boolean {
  if (n === 10 || n === 15) return true;
  return n > 15 && (n - 15) % 20 === 0;
}

const LINES = [
  "Wow, you’re on a roll!",
  "You’re on fire!",
  "Unstoppable!",
  "The crowd loves you!",
  "Picking machine!",
];

/** Headline for the nth milestone card (10 → first line, 15 → second, then cycles). */
export function rollLine(n: number): string {
  const i = n === 10 ? 0 : n === 15 ? 1 : 2 + (((n - 35) / 20) % (LINES.length - 2));
  return LINES[i] ?? LINES[0];
}

export const ROLL_KEY = "cp_roll_count";
