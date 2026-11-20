import { z } from "zod";
import { AGE_RANGE_IDS, KID_AGE_IDS, KIDS_STATUS_IDS, SEX_IDS } from "./constants";

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Must be http(s)")
  .optional()
  .or(z.literal("").transform(() => undefined));

const imageRef = z
  .string()
  .max(2_000_000)
  .refine((s) => s.startsWith("https://") || s.startsWith("data:image/") || s.startsWith("/"), "Invalid image")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const optionInput = z.object({
  label: z.string().trim().min(1, "Give this option a name").max(60),
  description: z.string().trim().max(140).optional(),
  imageUrl: imageRef,
  url: optionalUrl,
  urlTitle: z.string().max(300).optional(),
  urlImage: z.string().max(2000).optional(),
  priceCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  currency: z.string().max(5).optional().nullable(),
});

export const createBattleInput = z.object({
  title: z.string().trim().min(3).max(100),
  context: z.string().trim().max(280).optional().default(""),
  tags: z
    .object({
      kidAge: z.array(z.enum(KID_AGE_IDS)).max(5).optional(),
      recipient: z.string().max(30).optional(),
      budget: z.string().max(30).optional(),
      occasion: z.string().max(30).optional(),
    })
    .default({}),
  visibility: z.enum(["PUBLIC", "LINK_ONLY", "FRIENDS"]).default("PUBLIC"),
  deadlineHours: z.number().min(1).max(24 * 30),
  dataConsent: z.boolean().default(false),
  options: z.tuple([optionInput, optionInput]),
  /** Admin only: publish under this username (created if it doesn't exist). */
  postAs: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) => s.replace(/^@/, ""))
    .pipe(z.string().regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or underscores"))
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type CreateBattleInput = z.infer<typeof createBattleInput>;

export const voteInput = z.object({
  side: z.enum(["A", "B"]),
  reason: z.string().trim().max(140).optional(),
  dwellMs: z.number().int().min(0).max(3_600_000).optional(),
  source: z.enum(["link", "feed", "profile", "home"]).optional(),
});

export const reasonInput = z.object({ reason: z.string().trim().max(140) });

export const outcomeInput = z
  .object({
    chosen: z.enum(["A", "B", "NEITHER"]),
    thumb: z.enum(["UP", "DOWN"]).optional().nullable(),
    note: z.string().trim().max(280).optional(),
    photoUrl: imageRef,
  })
  .refine((v) => v.chosen === "NEITHER" || !!v.thumb, { message: "Pick 👍 or 👎", path: ["thumb"] });

/** US ZIP (12345 / 12345-6789) or a general postal code (3–10 letters, digits, spaces, dashes). */
export const ZIP_RE = /^(\d{5}(-\d{4})?|[A-Z0-9][A-Z0-9 -]{1,8}[A-Z0-9])$/;

export const profileInput = z.object({
  name: z.string().trim().min(1).max(50),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3–20 letters, numbers or underscores"),
  bio: z.string().trim().max(160).optional().default(""),
  isAdultConfirmed: z.literal(true, { errorMap: () => ({ message: "You must be 18 or older" }) }),
  kidsStatus: z.enum(KIDS_STATUS_IDS).nullable().optional(),
  kidAges: z.array(z.enum(KID_AGE_IDS)).default([]),
  zipCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ZIP_RE, "Enter a valid ZIP / postal code"),
  sex: z.enum(SEX_IDS, { errorMap: () => ({ message: "Choose an option for sex" }) }),
  ageRange: z.enum(AGE_RANGE_IDS, { errorMap: () => ({ message: "Choose your age range" }) }),
  country: z.string().trim().max(60).optional().default(""),
  region: z.string().trim().max(60).optional().default(""),
  interests: z.array(z.string().max(30)).max(12).default([]),
  dataConsent: z.boolean().default(false),
});

export const reportInput = z.object({
  targetType: z.enum(["BATTLE", "REASON", "USER"]),
  targetId: z.string().min(1).max(64),
  reason: z.enum(["spam", "inappropriate", "minor_safety", "harassment", "other"]),
  details: z.string().max(500).optional(),
});

export const CONTACT_TOPICS = [
  { id: "question", label: "Question" },
  { id: "bug", label: "Report a problem" },
  { id: "account", label: "Account or privacy" },
  { id: "safety", label: "Safety concern" },
  { id: "feedback", label: "Feedback or idea" },
  { id: "other", label: "Something else" },
] as const;

export const contactInput = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  email: z.string().trim().toLowerCase().email("Please enter a valid email so we can reply").max(254),
  topic: z.enum(CONTACT_TOPICS.map((t) => t.id) as [string, ...string[]]),
  message: z.string().trim().min(10, "Please tell us a bit more (10+ characters)").max(4000),
  pageUrl: z.string().max(500).optional(),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(200).optional(),
  // ms since the form rendered; bots submit instantly.
  elapsedMs: z.number().int().nonnegative().optional(),
});
