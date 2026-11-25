/**
 * "Ask Pickbot" card in the Vote deck (Shimon, Nov 26 2026): shown once per person, at a position that's tested.
 * Each account gets a stable random position from PROMO_POSITIONS (never in the first 3 cards): the card comes after
 * that many picks in a deck visit (this tab). The Brain compares positions by how many people saw it, tapped it and
 * went on to ask. Pure; tested in tests/unit/pickbot-promo.test.ts.
 */

/** Picks before the card shows. Never the first 3. */
export const PROMO_POSITIONS = [4, 5, 6, 8, 10, 12, 15, 20] as const;

/** FNV-1a 32-bit → [0, 1); same as services/ranking.ts `hashUnit` (kept here so the browser bundle stays server-free). */
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** The person's position: stable per account, spread evenly over PROMO_POSITIONS. */
export function promoPosition(userId: string): number {
  return PROMO_POSITIONS[Math.min(PROMO_POSITIONS.length - 1, Math.floor(unit(`pbpromo:${userId}`) * PROMO_POSITIONS.length))];
}

/** Show it now? After at least `at` picks this visit, once, and never on top of another special card. */
export function promoDue(a: { picks: number; at: number; shown: boolean; busy: boolean }): boolean {
  return !a.shown && !a.busy && a.picks >= a.at;
}
