/**
 * Unit economics for /admin/brain (Shimon, Nov 26 2026), pure: what one visitor is worth and so the most we can pay
 * to acquire one and break even. Measured inputs come from the Brain's own counts; prices are economy assumptions
 * (`ue*`). Tested in tests/unit/unit-economics.test.ts.
 *
 *   lifetime votes   = votes per visit × lifetime visits (measured visits per visitor unless overridden)
 *   ads              = lifetime votes ÷ votes per ad × ad CPM ÷ 1000
 *   sponsored        = lifetime votes × sponsored share × sponsored CPM ÷ 1000
 *   sign-ups         = sign-up rate × value of a signed-up user per year
 *   break-even       = ads + sponsored + sign-ups − serving cost per visitor
 */
export type UeInputs = { visitors: number; visits: number; votes: number; signups: number; costPerVisitor: number | null };
export type UeAssumptions = {
  ueAdCpm: number;
  ueVotesPerAd: number;
  ueSponsoredSharePct: number;
  ueSponsoredCpm: number;
  ueSignupValue: number;
  /** 0 = use the measured visits per visitor. */
  ueLifetimeVisits: number;
};

export function unitEconomics(i: UeInputs, a: UeAssumptions) {
  const votesPerVisitor = i.visitors ? i.votes / i.visitors : 0;
  const visitsPerVisitor = i.visitors ? i.visits / i.visitors : 0;
  const votesPerVisit = i.visits ? i.votes / i.visits : 0;
  const signupRate = i.visitors ? i.signups / i.visitors : 0;
  const lifetimeVisits = a.ueLifetimeVisits > 0 ? a.ueLifetimeVisits : visitsPerVisitor;
  const lifetimeVotes = votesPerVisit * lifetimeVisits;
  const ads = a.ueVotesPerAd > 0 ? (lifetimeVotes / a.ueVotesPerAd) * (a.ueAdCpm / 1000) : 0;
  const sponsored = lifetimeVotes * (a.ueSponsoredSharePct / 100) * (a.ueSponsoredCpm / 1000);
  const signups = signupRate * a.ueSignupValue;
  const revenue = ads + sponsored + signups;
  const cost = i.costPerVisitor ?? 0;
  return {
    visitors: i.visitors,
    votesPerVisitor,
    visitsPerVisitor,
    lifetimeVisits,
    lifetimeVotes,
    signupRate,
    revenue: { ads, sponsored, signups, total: revenue },
    cost,
    costKnown: i.costPerVisitor != null,
    breakEven: revenue - cost,
  };
}
export type UnitEconomics = ReturnType<typeof unitEconomics>;

/** Break-even if one lever moved (for the "what moves it" line): same inputs with that change applied. */
export function whatIf(i: UeInputs, a: UeAssumptions) {
  const now = unitEconomics(i, a);
  return {
    base: now.breakEven,
    doubleSignupRate: unitEconomics({ ...i, signups: i.signups * 2 }, a).breakEven,
    oneMoreVisit: unitEconomics(i, { ...a, ueLifetimeVisits: now.lifetimeVisits + 1 }).breakEven,
    signupValueX3: unitEconomics(i, { ...a, ueSignupValue: a.ueSignupValue * 3 }).breakEven,
  };
}

/** Small per-visitor money: 3 decimals under a dollar (4 under a cent), 2 from a dollar up. */
export function money(x: number): string {
  const sign = x < 0 ? "−" : "";
  const v = Math.abs(x);
  const digits = v >= 1 ? 2 : v >= 0.01 ? 3 : 4;
  return `${sign}$${v.toFixed(digits)}`;
}
