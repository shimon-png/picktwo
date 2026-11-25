import { z } from "zod";
import { after } from "next/server";
import { emailWelcome } from "@/server/services/lifecycle";
import { markSignupConversion } from "@/server/conversions";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { profileInput, zipField } from "@/lib/validators";
import { profileIncomplete } from "@/lib/profile";
import { saveQuickProfile, suggestHandle } from "@/server/services/profile";
import { getDeviceId } from "@/server/viewer";
import { deviceAnswers } from "@/server/services/about";

// One-tap sign-up: only the username is needed (and even that defaults to one made from the email).
const input = profileInput
  .pick({ handle: true, zipCode: true, sex: true, ageRange: true })
  .partial()
  .extend({ zipCode: zipField.optional().or(z.literal("")) });

/** What the sign-up flow still needs from this user. */
export const GET = handler(async () => {
  const u = await requireUser();
  // Prefill from this browser's about-you answers (they move onto the account at the next full page load).
  const deviceId = await getDeviceId();
  const a = deviceId ? await deviceAnswers(deviceId) : {};
  return {
    complete: !profileIncomplete(u),
    handle: u.handle ?? (await suggestHandle(u.email)),
    sex: u.sex ?? a.sex ?? null,
    ageRange: u.ageRange ?? a.age ?? null,
    zipCode: u.zipCode ?? a.zip ?? null,
  };
});

/** Last step of sign-up: username (default from the email) + optional sex / age range / ZIP. Finishes onboarding. */
export const POST = handler(async (req) => {
  const u = await requireUser();
  await rateLimit("quickProfile", u.id);
  const p = input.parse(await req.json());
  const first = !u.onboardedAt;
  await saveQuickProfile(u, p);
  if (first) {
    await markSignupConversion();
    after(() => emailWelcome(u.id));
  }
  return { ok: true };
});

export type QuickProfileInput = z.infer<typeof input>;
