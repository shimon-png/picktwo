import { and, eq, ne } from "drizzle-orm";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { db } from "@/server/db";
import { users, consentEvents } from "@/server/db/schema";
import { profileInput } from "@/lib/validators";
import { AppError } from "@/server/errors";
import { assertCleanText } from "@/server/moderation";
import { POLICY_VERSION } from "@/lib/constants";
import { track, trackProfileChanges } from "@/server/analytics";
import { z } from "zod";
import { after } from "next/server";
import { emailWelcome } from "@/server/services/lifecycle";
import { markSignupConversion } from "@/server/conversions";
import { setEmailGroup } from "@/server/services/mailer";
import { normalizeLocation } from "@/server/services/geo";
import { lookupZip } from "@/server/services/zip";

const settingsPatch = z.object({
  notifyEmail: z.boolean().optional(),
  marketingEmail: z.boolean().optional(),
  dataConsent: z.boolean().optional(),
  showInVoteMatches: z.boolean().optional(),
  chatEnabled: z.boolean().optional(),
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = await req.json();
  if (body?.kind === "email") {
    const p = z.object({ group: z.enum(["voted", "weekly", "tips", "messages"]), on: z.boolean() }).parse(body);
    await setEmailGroup(user.id, p.group, p.on);
    return { ok: true };
  }
  if (body?.kind === "settings") {
    const p = settingsPatch.parse(body);
    await db.update(users).set(p).where(eq(users.id, user.id));
    if (p.dataConsent !== undefined && p.dataConsent !== user.dataConsent)
      await db.insert(consentEvents).values({ userId: user.id, type: "data_training", value: p.dataConsent, version: POLICY_VERSION });
    return { ok: true };
  }
  const p = profileInput.parse(body);
  assertCleanText(p.name, p.handle, p.bio);
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.handle, p.handle), ne(users.id, user.id)));
  if (taken) throw new AppError("CONFLICT", "That handle is taken");
  const loc = normalizeLocation(p);
  if (!loc.ok) throw new AppError("VALIDATION", loc.message);
  // ZIP, sex and age are optional (one-tap sign-up, Nov 25 2026); blank clears them.
  let zip: { code: string; country: string; region: string | null; city: string | null } | null = null;
  if (p.zipCode) {
    const z = lookupZip(p.zipCode, loc.country);
    if (!z.ok) throw new AppError("VALIDATION", z.message);
    zip = z;
  }
  // No location picked yet: fill it in from the ZIP.
  const place = loc.country || !zip ? loc : { country: zip.country, region: zip.region, city: zip.city };
  const first = !user.onboardedAt;
  const demo = {
    kidsStatus: p.kidsStatus ?? (p.kidAges.length ? "YES" : null),
    kidAges: p.kidsStatus && p.kidsStatus !== "YES" ? [] : p.kidAges,
    country: place.country,
    region: place.region,
    city: place.city,
    zipCode: zip?.code ?? null,
    sex: p.sex || null,
    ageRange: p.ageRange || null,
    interests: p.interests,
    ...(p.relationship !== undefined ? { relationship: p.relationship } : {}),
    ...(p.housing !== undefined ? { housing: p.housing } : {}),
    ...(p.workStatus !== undefined ? { workStatus: p.workStatus } : {}),
  };
  await db
    .update(users)
    .set({
      name: p.name,
      handle: p.handle,
      bio: p.bio || null,
      isAdultConfirmed: true,
      kidsStatus: p.kidsStatus ?? (p.kidAges.length ? "YES" : null),
      kidAges: p.kidsStatus && p.kidsStatus !== "YES" ? [] : p.kidAges,
      country: place.country,
      region: place.region,
      city: place.city,
      zipCode: zip?.code ?? null,
      sex: p.sex || null,
      ageRange: p.ageRange || null,
      interests: p.interests,
      ...(p.relationship !== undefined ? { relationship: p.relationship } : {}),
      ...(p.housing !== undefined ? { housing: p.housing } : {}),
      ...(p.workStatus !== undefined ? { workStatus: p.workStatus } : {}),
      dataConsent: p.dataConsent,
      onboardedAt: user.onboardedAt ?? new Date(),
    })
    .where(eq(users.id, user.id));
  trackProfileChanges(user.id, user, demo, first ? "onboarding" : "settings");
  if (first) {
    await db.insert(consentEvents).values([
      { userId: user.id, type: "terms", value: true, version: POLICY_VERSION },
      { userId: user.id, type: "data_training", value: p.dataConsent, version: POLICY_VERSION },
    ]);
    track("onboarding_completed", { kidAges: p.kidAges.length, dataConsent: p.dataConsent }, { userId: user.id });
    await markSignupConversion();
    after(() => emailWelcome(user.id));
  } else if (p.dataConsent !== user.dataConsent) {
    await db.insert(consentEvents).values({ userId: user.id, type: "data_training", value: p.dataConsent, version: POLICY_VERSION });
  }
  return { ok: true };
});
