import { AppError } from "./errors";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

/** Returns true if text contains abusive language that should be blocked. */
export function isAbusive(text: string | undefined | null): boolean {
  if (!text) return false;
  return matcher.hasMatch(text);
}

export function assertCleanText(...texts: (string | undefined | null)[]) {
  for (const t of texts) {
    if (isAbusive(t)) throw new AppError("VALIDATION", "Please keep it friendly — that text contains language we don't allow.");
  }
}

/**
 * Optional automated image moderation. When MODERATION_PROVIDER=openai and OPENAI_API_KEY are set,
 * uses OpenAI omni-moderation. Returns { allowed: false } for flagged sexual/violent imagery.
 * With no provider configured, images are allowed (and can be reported/removed by admins).
 */
export async function moderateImage(imageUrl: string): Promise<{ allowed: boolean; reason?: string }> {
  if (process.env.MODERATION_PROVIDER !== "openai" || !process.env.OPENAI_API_KEY) return { allowed: true };
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [{ type: "image_url", image_url: { url: imageUrl } }],
      }),
    });
    if (!res.ok) return { allowed: true };
    const data = (await res.json()) as { results: { flagged: boolean; categories: Record<string, boolean> }[] };
    const r = data.results?.[0];
    if (r?.flagged) {
      const cats = Object.entries(r.categories)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (cats.some((c) => c.startsWith("sexual") || c.startsWith("violence") || c.startsWith("self-harm")))
        return { allowed: false, reason: cats.join(", ") };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
