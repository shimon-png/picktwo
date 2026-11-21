import { AppError } from "./errors";
import { decideImage, type ImageDecision } from "./services/safety";
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


/** Is an automated photo screener configured? (OpenAI omni-moderation: free, image-capable.) */
export function screeningEnabled() {
  return !!process.env.OPENAI_API_KEY && process.env.MODERATION_PROVIDER !== "none";
}

/**
 * Automated photo screening. With OPENAI_API_KEY set, every photo goes through OpenAI
 * omni-moderation (free) and `decideImage()` turns the scores into allow / review / block.
 * Fails closed: if the provider errors, the photo is held for review rather than published.
 * With no provider configured, photos are allowed unless `requireImageModeration` is on.
 */
export async function screenImage(imageUrl: string, opts: { requireModeration?: boolean } = {}): Promise<ImageDecision> {
  if (!screeningEnabled()) {
    return opts.requireModeration ? { verdict: "review", reasons: ["no screening provider configured"] } : { verdict: "allow", reasons: [] };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "image_url", image_url: { url: imageUrl } }] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("[moderation] OpenAI error", res.status, (await res.text()).slice(0, 300));
      return { verdict: "review", reasons: [`screening unavailable (${res.status})`] };
    }
    const data = (await res.json()) as { results?: { flagged: boolean; category_scores: Record<string, number> }[] };
    const r = data.results?.[0];
    if (!r) return { verdict: "review", reasons: ["screening returned no result"] };
    return decideImage(r.category_scores ?? {}, r.flagged);
  } catch (e) {
    console.error("[moderation] screening failed", e);
    return { verdict: "review", reasons: ["screening unavailable"] };
  }
}

/** Is a known-CSAM hash matcher configured? */
export function hashMatchEnabled() {
  return !!process.env.PHOTODNA_KEY;
}

/**
 * Known child-sexual-abuse-material hash matching via Microsoft PhotoDNA Cloud Service
 * (free for qualified orgs; apply at microsoft.com/photodna). Needs PHOTODNA_KEY; the endpoint
 * can be overridden with PHOTODNA_ENDPOINT. Only public https URLs can be checked.
 * Returns { match: true } on a hit; errors return { match: false, error } and the caller holds the photo.
 */
export async function hashMatchImage(imageUrl: string): Promise<{ match: boolean; error?: string; details?: unknown }> {
  if (!hashMatchEnabled() || !imageUrl.startsWith("https://")) return { match: false };
  const endpoint = process.env.PHOTODNA_ENDPOINT || "https://api.microsoftmoderator.com/photodna/v1.0/Match?enhance=false";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": process.env.PHOTODNA_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ DataRepresentation: "URL", Value: imageUrl }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { match: false, error: `PhotoDNA ${res.status}` };
    const data = (await res.json()) as { IsMatch?: boolean; MatchDetails?: unknown; Status?: { Code?: number; Description?: string } };
    if (data.Status?.Code !== undefined && data.Status.Code !== 3000) return { match: false, error: `PhotoDNA status ${data.Status.Code}` };
    return { match: !!data.IsMatch, details: data.MatchDetails };
  } catch {
    return { match: false, error: "PhotoDNA unavailable" };
  }
}
