import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { users, consentEvents, type User } from "../db/schema";
import { POLICY_VERSION } from "@/lib/constants";
import { track, trackProfileChanges } from "../analytics";
import { AppError } from "../errors";
import { assertCleanText } from "../moderation";
import { handleBase } from "./signin-code-utils";
import { suggestedHandle } from "@/lib/handles";
import { lookupZip } from "./zip";

/** A free username suggestion from the email: first name + 4 digits ("zoe4859"). The user can edit it. */
export async function suggestHandle(email: string | null): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const h = suggestedHandle(email);
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, h));
    if (!taken) return h;
  }
  return `${handleBase(email).slice(0, 14)}${Date.now().toString(36).slice(-5)}`;
}

/**
 * Saves the sign-up fields (username, sex, age range, ZIP) and finishes onboarding in one go. Age ranges start at 18, so picking one confirms the user is an adult.
 */
export async function saveQuickProfile(u: User, p: { handle?: string; zipCode?: string; sex?: string; ageRange?: string }) {
  const handle = p.handle || u.handle || (await suggestHandle(u.email));
  assertCleanText(handle);
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.handle, handle), ne(users.id, u.id)));
  if (taken) throw new AppError("CONFLICT", "That username is taken — try another");
  // ZIP, sex and age are optional since the one-tap sign-up; whatever is given is saved.
  let place: { zipCode?: string; country?: string | null; region?: string | null; city?: string | null } = {};
  if (p.zipCode) {
    const zip = lookupZip(p.zipCode, u.country);
    if (!zip.ok) throw new AppError("VALIDATION", zip.message);
    // Fill in the location from the ZIP unless the user already picked one.
    place = u.country ? { zipCode: zip.code } : { zipCode: zip.code, country: zip.country, region: zip.region, city: zip.city };
  }
  const demo = { ...place, ...(p.sex ? { sex: p.sex } : {}), ...(p.ageRange ? { ageRange: p.ageRange } : {}) };
  const first = !u.onboardedAt;
  await db
    .update(users)
    .set({
      ...demo,
      // Age ranges start at 18 and sign-up asks people to confirm they're adults.
      isAdultConfirmed: true,
      handle,
      onboardedAt: u.onboardedAt ?? new Date(),
    })
    .where(eq(users.id, u.id));
  trackProfileChanges(u.id, u, demo, "quick_profile");
  if (first) {
    await db.insert(consentEvents).values({ userId: u.id, type: "terms", value: true, version: POLICY_VERSION });
    track("onboarding_completed", { quick: true }, { userId: u.id });
  }
}
