import { z } from "zod";
import { after } from "next/server";
import { emailWelcome } from "@/server/services/lifecycle";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { profileInput } from "@/lib/validators";
import { profileIncomplete } from "@/lib/profile";
import { saveQuickProfile, suggestHandle } from "@/server/services/profile";

const input = profileInput.pick({ handle: true, zipCode: true, sex: true, ageRange: true });

/** What the sign-up flow still needs from this user. */
export const GET = handler(async () => {
  const u = await requireUser();
  return { complete: !profileIncomplete(u), handle: u.handle ?? (await suggestHandle(u.email)), sex: u.sex, ageRange: u.ageRange, zipCode: u.zipCode };
});

/** Last steps of the sign-up flow: username + the required sex / age range / ZIP. Finishes onboarding. */
export const POST = handler(async (req) => {
  const u = await requireUser();
  await rateLimit("quickProfile", u.id);
  const p = input.parse(await req.json());
  const first = !u.onboardedAt;
  await saveQuickProfile(u, p);
  if (first) after(() => emailWelcome(u.id));
  return { ok: true };
});

export type QuickProfileInput = z.infer<typeof input>;
