import { and, eq, ne } from "drizzle-orm";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { db } from "@/server/db";
import { users, consentEvents } from "@/server/db/schema";
import { profileInput } from "@/lib/validators";
import { AppError } from "@/server/errors";
import { assertCleanText } from "@/server/moderation";
import { POLICY_VERSION } from "@/lib/constants";
import { track } from "@/server/analytics";
import { z } from "zod";
import { normalizeLocation } from "@/server/services/geo";

const settingsPatch = z.object({
  notifyEmail: z.boolean().optional(),
  marketingEmail: z.boolean().optional(),
  dataConsent: z.boolean().optional(),
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = await req.json();
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
  const first = !user.onboardedAt;
  await db
    .update(users)
    .set({
      name: p.name,
      handle: p.handle,
      bio: p.bio || null,
      isAdultConfirmed: true,
      kidsStatus: p.kidsStatus ?? (p.kidAges.length ? "YES" : null),
      kidAges: p.kidsStatus && p.kidsStatus !== "YES" ? [] : p.kidAges,
      country: loc.country,
      region: loc.region,
      city: loc.city,
      zipCode: p.zipCode,
      sex: p.sex,
      ageRange: p.ageRange,
      interests: p.interests,
      dataConsent: p.dataConsent,
      onboardedAt: user.onboardedAt ?? new Date(),
    })
    .where(eq(users.id, user.id));
  if (first) {
    await db.insert(consentEvents).values([
      { userId: user.id, type: "terms", value: true, version: POLICY_VERSION },
      { userId: user.id, type: "data_training", value: p.dataConsent, version: POLICY_VERSION },
    ]);
    track("onboarding_completed", { kidAges: p.kidAges.length, dataConsent: p.dataConsent }, { userId: user.id });
  } else if (p.dataConsent !== user.dataConsent) {
    await db.insert(consentEvents).values({ userId: user.id, type: "data_training", value: p.dataConsent, version: POLICY_VERSION });
  }
  return { ok: true };
});
