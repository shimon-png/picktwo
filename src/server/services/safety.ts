/**
 * Pure trust & safety rules: how an automated image score turns into allow / review / block,
 * and when user flags hide a battle. No I/O here — keep it pure and unit-tested.
 */

export type ScreenVerdict = "allow" | "review" | "block";

/** Category score thresholds (0–1). At/above `block` the upload is refused; at/above `review` it is held for an admin. */
export const IMAGE_THRESHOLDS: Record<string, { review: number; block?: number }> = {
  sexual: { review: 0.25, block: 0.7 },
  "sexual/minors": { review: 0.05 },
  "violence/graphic": { review: 0.4, block: 0.8 },
  violence: { review: 0.6 },
  "self-harm": { review: 0.4 },
  "self-harm/intent": { review: 0.3 },
  "self-harm/instructions": { review: 0.3 },
};

export type ImageDecision = { verdict: ScreenVerdict; reasons: string[] };

/** Decide from per-category scores (as returned by OpenAI omni-moderation). */
export function decideImage(scores: Record<string, number>, flagged = false): ImageDecision {
  const block: string[] = [];
  const review: string[] = [];
  for (const [cat, t] of Object.entries(IMAGE_THRESHOLDS)) {
    const s = scores[cat] ?? 0;
    const tag = `${cat} ${s.toFixed(2)}`;
    if (t.block !== undefined && s >= t.block) block.push(tag);
    else if (s >= t.review) review.push(tag);
  }
  // Anything sexual involving minors is never auto-blocked silently: it goes to a human, who must report it.
  if (review.some((r) => r.startsWith("sexual/minors"))) return { verdict: "review", reasons: [...block, ...review] };
  if (block.length) return { verdict: "block", reasons: block };
  if (review.length) return { verdict: "review", reasons: review };
  if (flagged) return { verdict: "review", reasons: ["flagged by provider"] };
  return { verdict: "allow", reasons: [] };
}

/** Combine several image decisions (one per photo): the strictest wins. */
export function strictest(ds: ImageDecision[]): ImageDecision {
  const rank: Record<ScreenVerdict, number> = { allow: 0, review: 1, block: 2 };
  let verdict: ScreenVerdict = "allow";
  for (const d of ds) if (rank[d.verdict] > rank[verdict]) verdict = d.verdict;
  return { verdict, reasons: ds.filter((d) => d.verdict === verdict).flatMap((d) => d.reasons) };
}

/** Report reasons people can pick. `severe` ones hide the battle after fewer flags. */
export const REPORT_REASONS = [
  { id: "nudity", label: "Nudity or sexual content", severe: true },
  { id: "minor_safety", label: "Child safety concern", severe: true },
  { id: "violence", label: "Violence or gore", severe: false },
  { id: "harassment", label: "Harassment or hate", severe: false },
  { id: "inappropriate", label: "Other inappropriate content", severe: false },
  { id: "spam", label: "Spam or scam", severe: false },
  { id: "other", label: "Something else", severe: false },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
export const REPORT_REASON_IDS = REPORT_REASONS.map((r) => r.id) as [ReportReason, ...ReportReason[]];

/** System-generated report reasons (never picked by users). */
export const SYSTEM_REASONS = { autoScreen: "auto_screen", hashMatch: "csam_hash_match" } as const;

export const REASON_LABELS: Record<string, string> = {
  ...Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label])),
  auto_screen: "Held by automatic photo screening",
  csam_hash_match: "Known child abuse image match — report to NCMEC",
};

export type FlagCounts = { total: number; severe: number; childSafety: number };
export type AutoHideRules = { autoHideReports: number; severeAutoHideReports: number; childSafetyAutoHideReports: number };

/** Should open flags on a battle hide it pending admin review? Thresholds of 0 disable that rule. */
export function shouldAutoHide(c: FlagCounts, r: AutoHideRules): boolean {
  const hit = (n: number, t: number) => t > 0 && n >= t;
  return hit(c.childSafety, r.childSafetyAutoHideReports) || hit(c.severe, r.severeAutoHideReports) || hit(c.total, r.autoHideReports);
}

export function isSevere(reason: string) {
  return REPORT_REASONS.some((r) => r.id === reason && r.severe);
}
