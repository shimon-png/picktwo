/**
 * A signed-in user must have finished sign-up (a username). Since the one-tap sign-up (About-you plan, Nov 25 2026)
 * ZIP, sex and age range are optional at sign-up: the Vote deck asks for them later as about-you cards, and
 * targeting already treats a missing answer as "not in the group".
 */
export type ProfileFields = { onboardedAt: Date | null; zipCode?: string | null; sex?: string | null; ageRange?: string | null };

export function profileIncomplete(u: ProfileFields): boolean {
  return !u.onboardedAt;
}

/** Where to send a signed-in user whose profile is incomplete. */
export function onboardingUrl(next?: string) {
  return next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
}
