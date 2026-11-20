/** Fields every signed-in user must have before using the app (onboarding + ZIP, sex, age range). */
export type ProfileFields = { onboardedAt: Date | null; zipCode: string | null; sex: string | null; ageRange: string | null };

export function profileIncomplete(u: ProfileFields): boolean {
  return !u.onboardedAt || !u.zipCode || !u.sex || !u.ageRange;
}

/** Where to send a signed-in user whose profile is incomplete. */
export function onboardingUrl(next?: string) {
  return next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
}
