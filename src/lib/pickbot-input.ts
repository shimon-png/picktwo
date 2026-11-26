/** Request shapes for the Pickbot API routes (zod). */
import { z } from "zod";
import { ABOUT_QUESTION_IDS } from "./about";

const photo = z.string().refine((u) => u.startsWith("https://") || u.startsWith("data:image/"), "Bad photo");

export const askInput = z.object({
  text: z.string().trim().min(3, "Ask a little more").max(2000, "Keep it under 2,000 characters"),
  photos: z.array(photo).max(4).default([]),
  /** "People like you are asking" preset it started from (lib/asking.ts). */
  preset: z.string().regex(/^[a-z_]{2,40}$/).optional(),
});

export const gateInput = z.object({
  question: z.enum(ABOUT_QUESTION_IDS),
  answer: z.string().trim().min(1).max(24),
  label: z.string().trim().max(40).nullable().default(null),
  kidAges: z.array(z.string().max(12)).max(6).optional(),
});

export const stepInput = z.object({ action: z.enum(["retailor", "stop"]) });

export const rateInput = z.object({ messageId: z.string().max(40), rating: z.enum(["UP", "DOWN"]), note: z.string().max(200).optional() });

export const postCrowdInput = z.object({
  title: z.string().trim().min(3).max(160),
  context: z.string().trim().max(280).default(""),
  a: z.string().trim().min(1).max(60),
  b: z.string().trim().min(1).max(60),
  withPhotos: z.boolean().default(true),
  hours: z.number().int().min(1).max(120).default(24),
  targetLikeMe: z.boolean().default(true),
});

export const outcomeInput = z.object({ chosen: z.enum(["A", "B", "NEITHER"]) });
