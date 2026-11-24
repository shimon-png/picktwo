import { REPORT_REASON_IDS } from "@/server/services/safety";
import { z } from "zod";
import { AGE_RANGE_IDS, KID_AGE_IDS, KIDS_STATUS_IDS, SEX_IDS, TITLE_MAX } from "./constants";

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
  title: z.string().trim().min(3).max(TITLE_MAX),
  context: z.string().trim().max(280).optional().default(""),
  tags: z
    .object({
      kidAge: z.array(z.enum(KID_AGE_IDS)).max(5).optional(),
      recipient: z.string().max(30).optional(),
      budget: z.string().max(30).optional(),
      occasion: z.string().max(30).optional(),
      target: z
        .object({
          zips: z.array(z.string().trim().max(10)).max(20).optional(),
          parents: z.enum(["YES", "NO"]).optional(),
          kidAges: z.array(z.enum(KID_AGE_IDS)).max(5).optional(),
          ageRanges: z.array(z.enum(AGE_RANGE_IDS)).max(6).optional(),
          sexes: z.array(z.enum(["MALE", "FEMALE"])).max(2).optional(),
        })
        .optional(),
    })
    .default({}),
  visibility: z.enum(["PUBLIC", "LINK_ONLY", "FRIENDS"]).default("PUBLIC"),
  /** Longer requests (old drafts, cached clients) are cut to 5 days rather than refused; createBattle also clamps to maxBattleHours. */
  deadlineHours: z
    .number()
    .min(1)
    .transform((h) => Math.min(h, 24 * 5)),
  /** Ignored: data use follows the author's account setting (Settings → Data & privacy). */
  dataConsent: z.boolean().optional(),
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
  source: z.enum(["link", "feed", "profile", "home", "discover", "search"]).optional(),
  /** Data-brain context (docs/brain/data-dictionary.md): how the pick was made and where in the deck. */
  meta: z
    .object({
      method: z.enum(["tap", "swipe", "key", "button"]).optional(),
      pos: z.number().int().min(0).max(100_000).optional(),
      sessionId: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/).optional(),
    })
    .optional(),
});

/** Event names the browser may log through POST /api/events. Keep docs/brain/data-dictionary.md in sync. */
export const CLIENT_EVENTS = ["session_start", "page_view", "card_shown", "signup_gate_shown", "signup_gate_closed", "engaged", "home_click"] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];
const safeId = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/);
export const clientEventsInput = z.object({
  events: z
    .array(
      z.object({
        id: safeId,
        name: z.enum(CLIENT_EVENTS),
        at: z.number().int().min(0).max(4_102_444_800_000),
        sessionId: safeId,
        seq: z.number().int().min(0).max(10_000_000),
        props: z.record(z.unknown()).refine((p) => JSON.stringify(p).length <= 2000, "props too large"),
      }),
    )
    .min(1)
    .max(50),
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
  region: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  interests: z.array(z.string().max(30)).max(12).default([]),
  dataConsent: z.boolean().default(false),
});

export const messageInput = z.object({
  to: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1, "Write a message first").max(1000, "Messages can be up to 1000 characters"),
});

export const messageReportInput = z.object({
  messageId: z.string().min(1).max(64),
  reason: z.enum(REPORT_REASON_IDS),
});

export const reportInput = z.object({
  targetType: z.enum(["BATTLE", "REASON", "USER"]),
  targetId: z.string().min(1).max(64),
  reason: z.enum(REPORT_REASON_IDS),
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
