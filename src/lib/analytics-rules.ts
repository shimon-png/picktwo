/** Pure data-brain rules (tested in tests/unit/events.test.ts). */
/** Crawlers, headless browsers and monitors: kept, but flagged so analyses can leave them out. */
export function isBotUserAgent(ua: string): boolean {
  return !ua || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|monitor|curl|wget|python|axios|node-fetch/i.test(ua);
}

const PROFILE_FIELDS = [
  "sex",
  "ageRange",
  "zipCode",
  "kidsStatus",
  "kidAges",
  "country",
  "region",
  "city",
  "interests",
  "relationship",
  "housing",
  "workStatus",
] as const;
export type ProfileFields = Partial<Record<(typeof PROFILE_FIELDS)[number], unknown>>;

export function profileDiff(before: ProfileFields, after: ProfileFields): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of PROFILE_FIELDS) {
    if (!(k in after)) continue;
    const a = JSON.stringify(before[k] ?? null);
    const b = JSON.stringify(after[k] ?? null);
    if (a !== b) out[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  return out;
}
