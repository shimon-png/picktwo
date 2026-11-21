import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { users, consentEvents, type User } from "../db/schema";
import { POLICY_VERSION } from "@/lib/constants";
import { track } from "../analytics";
import { AppError } from "../errors";
import { assertCleanText } from "../moderation";
import { handleBase } from "./signin-code-utils";

/** A free username suggestion based on the email. */
export async function suggestHandle(email: string | null): Promise<string> {
  const base = handleBase(email);
  for (let i = 0; i < 8; i++) {
    const h = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, h));
    if (!taken) return h;
  }
  return `${base}${Date.now().toString(36).slice(-5)}`;
}

/**
 * Saves the sign-up fields (username, sex, age range, ZIP) and finishes onboarding in one go. Age ranges start at 18, so picking one confirms the user is an adult.
 */
export async function saveQuickProfile(u: User, p: { handle: string; zipCode: string; sex: string; ageRange: string }) {
  assertCleanText(p.handle);
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.handle, p.handle), ne(users.id, u.id)));
  if (taken) throw new AppError("CONFLICT", "That username is taken — try another");
  const first = !u.onboardedAt;
  await db
    .update(users)
    .set({
      zipCode: p.zipCode,
      sex: p.sex,
      ageRange: p.ageRange,
      isAdultConfirmed: true,
      handle: p.handle,
      onboardedAt: u.onboardedAt ?? new Date(),
    })
    .where(eq(users.id, u.id));
  if (first) {
    await db.insert(consentEvents).values({ userId: u.id, type: "terms", value: true, version: POLICY_VERSION });
    track("onboarding_completed", { quick: true }, { userId: u.id });
  }
}
