/**
 * Battle audience targeting ("Target a specific group?" in the composer). Pure, unit tested.
 *
 * A battle's target lives in `battle.tags.target`. Every dimension that is set must match the
 * viewer's profile (AND across dimensions, OR within one). A viewer with no answer for a
 * targeted dimension (signed out, "prefer not to say", no ZIP) doesn't match it.
 * Targeting only shapes the vote deck; anyone with the link can still open and vote.
 */
export type TargetSex = "MALE" | "FEMALE";
export type BattleTarget = {
  /** ZIP / postal codes or prefixes ("94110", "941"). */
  zips?: string[];
  /** YES = parents only, NO = people without kids only. */
  parents?: "YES" | "NO";
  /** Only with parents = YES: parents of kids in any of these age ranges. */
  kidAges?: string[];
  /** Viewer's own age range, any of these. */
  ageRanges?: string[];
  sexes?: TargetSex[];
};

export type TargetViewer = {
  zipCode: string | null;
  kidsStatus: string | null;
  kidAges: string[];
  ageRange: string | null;
  sex: string | null;
};

export const normalizeZip = (z: string) => z.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Drops empty dimensions; returns undefined when nothing is targeted. */
export function cleanTarget(t: BattleTarget | null | undefined): BattleTarget | undefined {
  if (!t) return undefined;
  const out: BattleTarget = {};
  const zips = [...new Set((t.zips ?? []).map(normalizeZip).filter((z) => z.length >= 3))];
  if (zips.length) out.zips = zips;
  if (t.parents === "YES" || t.parents === "NO") out.parents = t.parents;
  if (out.parents === "YES" && t.kidAges?.length) out.kidAges = [...new Set(t.kidAges)];
  if (t.ageRanges?.length) out.ageRanges = [...new Set(t.ageRanges)];
  const sexes = [...new Set(t.sexes ?? [])].filter((s) => s === "MALE" || s === "FEMALE");
  // Both men and women = everyone (incl. "prefer not to say"), so it isn't a filter.
  if (sexes.length === 1) out.sexes = sexes;
  return Object.keys(out).length ? out : undefined;
}

export function matchesTarget(target: BattleTarget | null | undefined, v: TargetViewer | null): boolean {
  const t = cleanTarget(target);
  if (!t) return true;
  if (!v) return false;
  if (t.zips) {
    const zip = v.zipCode ? normalizeZip(v.zipCode) : "";
    if (!zip || !t.zips.some((z) => zip.startsWith(z))) return false;
  }
  if (t.parents === "NO" && v.kidsStatus !== "NO") return false;
  if (t.parents === "YES") {
    if (v.kidsStatus !== "YES" && !v.kidAges.length) return false;
    if (t.kidAges && !t.kidAges.some((k) => v.kidAges.includes(k))) return false;
  }
  if (t.ageRanges && (!v.ageRange || !t.ageRanges.includes(v.ageRange))) return false;
  if (t.sexes && (!v.sex || !t.sexes.includes(v.sex as TargetSex))) return false;
  return true;
}
