/**
 * Taste profiles (data brain Phase 2b), pure parts. A person's picks on AI-tagged battles add up the traits of
 * the side they chose (battle.tags.brain.a / .b). Groups are compared by "lift": how much more often a trait
 * shows up in a group's picks than in everyone's. Privacy: only groups, never individuals, and only groups of
 * at least MIN_GROUP_PEOPLE consenting people. Tested in tests/unit/taste-rules.test.ts.
 */

export const MIN_GROUP_PEOPLE = 20;

export type TraitCounts = Record<string, number>;

export function addTraits(into: TraitCounts, traits: string[]) {
  for (const t of traits) into[t] = (into[t] ?? 0) + 1;
  return into;
}

/** Share of each trait among all trait mentions. */
export function shares(c: TraitCounts): Record<string, number> {
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  if (!total) return out;
  for (const [k, v] of Object.entries(c)) out[k] = v / total;
  return out;
}

/** Traits most over-represented in a group vs everyone (lift > 1), strongest first. Needs `minCount` mentions. */
export function topLifts(group: TraitCounts, everyone: TraitCounts, n = 3, minCount = 5): { trait: string; lift: number }[] {
  const g = shares(group);
  const e = shares(everyone);
  return Object.entries(g)
    .filter(([t]) => (group[t] ?? 0) >= minCount && e[t] > 0)
    .map(([trait, s]) => ({ trait, lift: s / e[trait] }))
    .filter((x) => x.lift > 1)
    .sort((a, b) => b.lift - a.lift)
    .slice(0, n);
}
