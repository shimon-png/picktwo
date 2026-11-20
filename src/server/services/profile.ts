import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, consentEvents, type User } from "../db/schema";
import { POLICY_VERSION } from "@/lib/constants";
import { track } from "../analytics";
import { handleBase } from "./signin-code-utils";

async function freeHandle(email: string | null): Promise<string> {
  const base = handleBase(email);
  for (let i = 0; i < 8; i++) {
    const h = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, h));
    if (!taken) return h;
  }
  return `${base}${Date.now().toString(36).slice(-5)}`;
}

/**
 * Saves the required sign-up fields and finishes onboarding in one go. New users get a handle from their
 * email (editable later in Settings). Age ranges start at 18, so picking one confirms the user is an adult.
 */
export async function saveQuickProfile(u: User, p: { zipCode: string; sex: string; ageRange: string }) {
  const first = !u.onboardedAt;
  await db
    .update(users)
    .set({
      zipCode: p.zipCode,
      sex: p.sex,
      ageRange: p.ageRange,
      isAdultConfirmed: true,
      handle: u.handle ?? (await freeHandle(u.email)),
      onboardedAt: u.onboardedAt ?? new Date(),
    })
    .where(eq(users.id, u.id));
  if (first) {
    await db.insert(consentEvents).values({ userId: u.id, type: "terms", value: true, version: POLICY_VERSION });
    track("onboarding_completed", { quick: true }, { userId: u.id });
  }
}
