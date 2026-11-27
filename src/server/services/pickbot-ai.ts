/**
 * Pickbot's Claude calls (PRD §7). Three jobs:
 *  - classifyQuestion (Haiku 5.5): scope (decision / advice / off-topic / sensitive), theme, relevant extended
 *    profile fields, a short title, crisis signals.
 *  - streamAnswer (Sonnet 5.5 by default, Opus 5.5 via economy `pickbotModelOpus`): the structured answer, streamed.
 *  - draftCrowdBattle (Haiku 5.5): an anonymous two-option battle from the thread, for the asker to review.
 * Claude only ever gets ranges (sex, age range, region), never a name, email, username or exact ZIP.
 * PICKBOT_FAKE_AI=true returns canned replies (local dev and the e2e run, no API key needed).
 */
import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "../errors";
import {
  ANSWER_SCHEMA,
  SMALL_MODEL,
  callCost,
  parseAnswer,
  parseClassification,
  scrubIdentifiers,
  type Answer,
  type AnswerKind,
  type Classification,
  type Usage,
} from "@/lib/pickbot";
import { THEMES } from "@/lib/brain-tags";

const fake = () => process.env.PICKBOT_FAKE_AI === "true";
export const pickbotConfigured = () => fake() || !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError("UNAVAILABLE", "Pickbot isn't set up yet.");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type CallStats = { model: string; inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number };
const stats = (model: string, u: Usage, started: number): CallStats => ({
  model,
  inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
  outputTokens: u.output_tokens ?? 0,
  costUsd: callCost(model, u),
  latencyMs: Date.now() - started,
});

/** Image blocks for photos: public URLs as-is, inline data URLs (dev uploads) as base64. */
function imageBlocks(photos: string[]): Anthropic.ImageBlockParam[] {
  return photos.slice(0, 4).flatMap((url): Anthropic.ImageBlockParam[] => {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(url);
    if (m) return [{ type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } }];
    if (/^https:\/\//.test(url)) return [{ type: "image", source: { type: "url", url } }];
    return [];
  });
}

function jsonText(msg: Anthropic.Message): unknown {
  const t = msg.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// ---------- classifier ----------

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    scope: { type: "string", enum: ["decision", "advice", "off_topic", "sensitive"] },
    theme: { type: "string", enum: [...THEMES] },
    extended: { type: "array", items: { type: "string", enum: ["kids", "housing", "work"] } },
    title: { type: "string" },
    crisis: { type: "boolean" },
  },
  required: ["scope", "theme", "extended", "title", "crisis"],
  additionalProperties: false,
} as const;

const CLASSIFY_SYSTEM = `You sort questions sent to Pickbot, a decision helper inside a voting app where people pick between two options.
Return JSON only.
- scope: "decision" (choosing between options), "advice" (what should I do / is this OK), "sensitive" (health, legal, money with real risk, or relationships with abuse signals), "off_topic" (not a personal decision or opinion: coding, homework, trivia, writing tasks, anything else).
- theme: the closest theme from the list.
- extended: which extra profile facts would change the answer: "kids" (parenting, family plans), "housing" (moving, renting, buying a home), "work" (career, job, school). Usually empty.
- title: the question in at most 8 words, in the asker's voice, no names.
- crisis: true only for self-harm, suicide, or someone in danger.`;

export async function classifyQuestion(text: string, photos: string[]): Promise<{ c: Classification; stats: CallStats | null }> {
  if (fake()) {
    const off = /\b(code|python|homework|essay|capital of)\b/i.test(text);
    const kids = /\b(kid|kids|son|daughter|baby|toddler)\b/i.test(text);
    return { c: parseClassification({ scope: off ? "off_topic" : "decision", theme: /dress|outfit|shoes/i.test(text) ? "fashion_beauty" : "other", extended: kids ? ["kids"] : [], title: text.slice(0, 60), crisis: false }, text), stats: null };
  }
  const started = Date.now();
  const msg = await anthropic().messages.create({
    model: SMALL_MODEL,
    max_tokens: 3000,
    system: CLASSIFY_SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: CLASSIFY_SCHEMA } },
    messages: [{ role: "user", content: [...imageBlocks(photos), { type: "text", text: `Question: ${text}` }] }],
  });
  return { c: parseClassification(jsonText(msg), text), stats: stats(SMALL_MODEL, msg.usage, started) };
}

// ---------- the answer ----------

const ANSWER_SYSTEM = `You are Pickbot, the decision helper inside crowdpick, an app where people vote between two options.
Someone brings you a choice. Give them one clear answer that fits who they are.

Voice: warm, direct and brief, like a smart friend. Plain words. No lists, no headings, no emoji, no "As an AI".

Return JSON with these fields, in this order:
- pick: the choice in a few words ("The green dress", "Text him back", "Keep looking"). Say "It depends on …" only when the options are truly balanced for this person.
- why: 2–3 short sentences on why it fits THIS person: tie it to their taste traits and situation from the profile. If the profile is thin, say what you're assuming.
- crowd: one sentence on how people like them voted on the similar battles provided, using only those numbers. Never invent a number. Empty string if no battles were provided.
- confidence: "sure", "fairly_sure" or "toss_up".
- flip: the one condition that would change your pick.
- care: for health, legal, money-with-real-risk or safety topics, one line suggesting a professional (general information only). If anyone may be in danger, point to 988 (US Suicide & Crisis Lifeline) or local emergency services. Otherwise an empty string.

Rules:
- Use the profile to tailor, but never repeat sensitive details back word for word, and never guess at things not given.
- Photos: refer to them as the first / second photo or by what they show. Never comment on bodies or attractiveness.
- Don't push purchases, brands or sponsors.
- Follow-up messages continue the same decision; answer the new message in the same JSON shape.`;

export type ProfileForAi = {
  sex?: string | null;
  ageRange?: string | null;
  relationship?: string | null;
  region?: string | null;
  kids?: string | null;
  housing?: string | null;
  work?: string | null;
  battlesAnswered: number;
  target: number;
  traits: { left: string; right: string; score: number }[];
  typeName: string | null;
};

export type SimilarBattle = { title: string; a: string; b: string; votesA: number; votesB: number; likeA: number | null; likeB: number | null };

export type Turn = { role: "USER" | "BOT"; text: string; photos: string[] };

function profileText(p: ProfileForAi, kind: AnswerKind, likeLabel: string | null): string {
  const lines = [
    `Answer type: ${kind === "tailored" ? "TAILORED (complete taste profile)" : `GENERAL (taste profile ${p.battlesAnswered}/${p.target} battles; lean less on traits)`}`,
    `Sex: ${p.sex ?? "unknown"}`,
    `Age range: ${p.ageRange ?? "unknown"}`,
    `Relationship: ${p.relationship ?? "unknown"}`,
    `Region: ${p.region ?? "unknown"}`,
  ];
  if (p.kids) lines.push(`Kids: ${p.kids}`);
  if (p.housing) lines.push(`Home: ${p.housing}`);
  if (p.work) lines.push(`Work: ${p.work}`);
  if (p.traits.length)
    lines.push("Taste traits from their votes (+1 = fully the first pole, -1 = fully the second, 0 = in between):", ...p.traits.map((t) => `- ${t.left} ↔ ${t.right}: ${t.score.toFixed(2)}`));
  if (p.typeName) lines.push(`Taste type: ${p.typeName}`);
  if (likeLabel) lines.push(`"People like them" group: ${likeLabel}`);
  return lines.join("\n");
}

function crowdText(similar: SimilarBattle[], likeLabel: string | null): string {
  if (!similar.length) return "Similar battles: none with enough votes yet. Leave `crowd` empty.";
  return [
    "Similar battles on crowdpick (everyone, and people like them where known):",
    ...similar.map((b) => {
      const tot = b.votesA + b.votesB;
      const pa = Math.round((b.votesA / tot) * 100);
      const like = b.likeA != null && b.likeB != null && b.likeA + b.likeB > 0 ? `; ${likeLabel ?? "people like them"}: ${Math.round((b.likeA / (b.likeA + b.likeB)) * 100)}% "${b.a}" (${b.likeA + b.likeB} votes)` : "";
      return `- "${b.title}": ${pa}% "${b.a}" vs ${100 - pa}% "${b.b}" (${tot} votes)${like}`;
    }),
  ].join("\n");
}

const FAKE_ANSWER: Answer = {
  pick: "The first option",
  why: "You lean toward bolder picks for events, and the first one stands out more. It also matches how you usually vote on style questions.",
  crowd: "",
  confidence: "fairly_sure",
  flip: "If the dress code is formal, go with the second.",
  care: "",
};

/**
 * Streams the answer. `onText` gets each raw JSON chunk (the UI reads fields as they arrive). Returns the parsed
 * answer and call stats. Refusals and unparseable replies throw a friendly error.
 */
export async function streamAnswer(
  a: { model: string; kind: AnswerKind; profile: ProfileForAi; similar: SimilarBattle[]; likeLabel: string | null; turns: Turn[] },
  onText: (chunk: string) => void,
): Promise<{ answer: Answer; stats: CallStats }> {
  const started = Date.now();
  if (fake()) {
    const json = JSON.stringify({ ...FAKE_ANSWER, crowd: a.similar.length ? `People like you split on ${a.similar.length} similar battles.` : "" });
    for (let i = 0; i < json.length; i += 24) {
      onText(json.slice(i, i + 24));
      await new Promise((r) => setTimeout(r, 15));
    }
    return { answer: parseAnswer(JSON.parse(json))!, stats: { model: "fake", inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: Date.now() - started } };
  }
  const context = `${profileText(a.profile, a.kind, a.likeLabel)}\n\n${crowdText(a.similar, a.likeLabel)}`;
  const messages: Anthropic.MessageParam[] = [];
  a.turns.forEach((t, i) => {
    if (t.role === "BOT") messages.push({ role: "assistant", content: t.text });
    else
      messages.push({
        role: "user",
        content: [
          // Person + crowd context rides on the first turn, so the cached prefix stays stable through follow-ups.
          ...(i === 0 ? [{ type: "text" as const, text: `<profile_and_crowd>\n${context}\n</profile_and_crowd>` }] : []),
          ...imageBlocks(t.photos),
          { type: "text" as const, text: t.text },
        ],
      });
  });
  const stream = anthropic().messages.stream({
    model: a.model,
    max_tokens: 8000,
    system: [{ type: "text", text: ANSWER_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: ANSWER_SCHEMA } },
    messages,
  });
  stream.on("text", (t) => onText(t));
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new AppError("VALIDATION", "Pickbot can't help with that one. Try asking it another way.");
  const answer = parseAnswer(jsonText(msg));
  if (!answer) throw new AppError("UNAVAILABLE", "Pickbot got tongue-tied. Try again in a moment.");
  return { answer, stats: stats(a.model, msg.usage, started) };
}

// ---------- crowd draft ----------

export type CrowdDraft = { title: string; context: string; a: string; b: string; pickSide: "A" | "B" | null; removed: string[] };

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    context: { type: "string" },
    a: { type: "string" },
    b: { type: "string" },
    pick_side: { type: "string", enum: ["A", "B", "none"] },
    removed: { type: "array", items: { type: "string" } },
  },
  required: ["title", "context", "a", "b", "pick_side", "removed"],
  additionalProperties: false,
} as const;

const DRAFT_SYSTEM = `Turn a private question into an ANONYMOUS public poll with exactly two options, for strangers to vote on.
- title: the question in the asker's own casual first-person voice, at most 140 characters, ending with a question mark.
- context: one optional short line of background that helps voters (or an empty string). Never repeat the title.
- a, b: the two options, 1–4 words each ("Green", "Burgundy"; "Text him", "Wait"). If photos are attached, option a is the first photo and b the second.
- pick_side: which option matches Pickbot's earlier pick ("A", "B" or "none").
- removed: short labels of what you left out to keep it anonymous (e.g. "a name", "the workplace", "the street").
Anonymity: remove names, usernames, workplaces, schools, places smaller than a city, phone numbers, emails, links, dates of birth and any detail that could identify the asker or anyone else. Keep it natural, not robotic.`;

export async function draftCrowdBattle(a: { question: string; followUps: string[]; pick: string; photoCount: number }): Promise<{ draft: CrowdDraft; stats: CallStats | null }> {
  const clean = (d: CrowdDraft): CrowdDraft => {
    const t = scrubIdentifiers(d.title);
    const c = scrubIdentifiers(d.context);
    const oa = scrubIdentifiers(d.a);
    const ob = scrubIdentifiers(d.b);
    const removed = [...new Set([...d.removed, ...t.removed, ...c.removed, ...oa.removed, ...ob.removed])];
    return { ...d, title: t.text.slice(0, 160), context: c.text.slice(0, 280), a: oa.text.slice(0, 60) || "Option A", b: ob.text.slice(0, 60) || "Option B", removed };
  };
  if (fake()) {
    return { draft: clean({ title: a.question.replace(/\s+/g, " ").slice(0, 140), context: "", a: "First one", b: "Second one", pickSide: "A", removed: [] }), stats: null };
  }
  const started = Date.now();
  const msg = await anthropic().messages.create({
    model: SMALL_MODEL,
    max_tokens: 3000,
    system: DRAFT_SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: DRAFT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Question: ${a.question}\n${a.followUps.length ? `Follow-ups: ${a.followUps.join(" / ")}\n` : ""}Photos attached: ${a.photoCount}\nPickbot's pick: ${a.pick}`,
      },
    ],
  });
  const r = (jsonText(msg) ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const draft: CrowdDraft = {
    title: s(r.title) || a.question.slice(0, 140),
    context: s(r.context),
    a: s(r.a),
    b: s(r.b),
    pickSide: r.pick_side === "A" || r.pick_side === "B" ? r.pick_side : null,
    removed: Array.isArray(r.removed) ? r.removed.filter((x): x is string => typeof x === "string").slice(0, 8) : [],
  };
  return { draft: clean(draft), stats: stats(SMALL_MODEL, msg.usage, started) };
}

// ---------- "People like you are worried about" questions ----------

const ASKING_SCHEMA = {
  type: "object",
  properties: { questions: { type: "array", items: { type: "string" } } },
  required: ["questions"],
  additionalProperties: false,
} as const;

const ASKING_SYSTEM = `You write the "People similar to you are worried about" card in crowdpick, a voting app with a decision helper called Pickbot.
Write short questions this person would plausibly be stuck on right now, in their own casual first-person words, each one a real decision they could ask Pickbot about.

Return JSON: {"questions": [...]} with exactly the number asked for.

Each question:
- 40 to 120 characters, one sentence or two short ones, ends with "?". Usually two clear options ("Stay or move?", "Text again or wait?").
- Sounds like a real person typing, not an ad or a headline. No emoji, no names, no brands, no links.
- Fits the person: their age range, sex, relationship, kids, home and work when given, the season, and what they've been voting on lately.
- Weigh heavily toward what people are most worried about this year: money and affordability (rent, groceries, debt, saving), the economy, job security, layoffs and AI taking jobs, and political differences in families (e.g. a parent who votes the other way, whether to invite them, how to keep the peace). Mix in a little everyday life (dating, friends, family) so it doesn't feel heavy.
- Never repeats or rewords anything in "Already asked or shown". Change the subject away from what they already asked Pickbot.
- Vary the topics: no two questions about the same thing.
- Make them feel written for this one person: follow how they vote (their picks show what they lean toward: careful or bold, saver or spender, family-first or me-first) and echo their situation. Vary the wording and sentence shapes so no two people get the same lines; avoid stock openings like "Should I".
- Nothing about self-harm, medical diagnoses, or anything sexual.`;

/** Fresh questions for one person (Haiku). Ranges only: never a name, email, username or exact ZIP. */
export async function writeAskingQuestions(input: {
  count: number;
  profile: Record<string, string | null | undefined>;
  month: string;
  recentVotes: string[];
  pickbotTopics: string[];
  already: string[];
}): Promise<{ questions: unknown; stats: CallStats | null }> {
  if (fake()) {
    const bank = [
      "Rent is going up again. Get a roommate or move further out?",
      "Hearing layoff rumors at work. Start applying now or wait it out?",
      "My dad votes the other way and it always blows up. Invite him for the holidays anyway?",
      "Pay off my credit card first or build an emergency fund?",
      "Worried AI will replace my job. Learn new skills or switch fields?",
      "Grocery bill keeps climbing. Cancel the streaming apps or cook more?",
      "Ask for a raise now or wait until reviews?",
      "Skip the family group chat when it gets political, or say something?",
      "Take a lower-paying job that feels safer, or stay where I am?",
      "Lend my sister money for rent, or say no this time?",
      "Second date went well. Ask for a third or let them ask?",
      "Move back in with my parents to save, or keep my place?",
      "Buy a used car now or keep fixing the old one?",
      "Tell my friends I can't afford the trip, or just put it on my card?",
      "My partner and I vote differently. Talk about it or keep politics out?",
    ];
    return { questions: { questions: bank.slice(0, input.count) }, stats: null };
  }
  const profile = Object.entries(input.profile)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const text = [
    `Write ${input.count} questions.`,
    `Month: ${input.month}`,
    profile ? `About them (ranges only):\n${profile}` : "About them: not much yet.",
    input.recentVotes.length ? `Battles they voted on lately (and what they picked):\n- ${input.recentVotes.join("\n- ")}` : "",
    input.pickbotTopics.length ? `What they already asked Pickbot about (change the subject):\n- ${input.pickbotTopics.join("\n- ")}` : "",
    input.already.length ? `Already asked or shown (never repeat):\n- ${input.already.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const started = Date.now();
  const msg = await anthropic().messages.create({
    model: SMALL_MODEL,
    max_tokens: 3000,
    system: ASKING_SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: ASKING_SCHEMA } },
    messages: [{ role: "user", content: [{ type: "text", text }] }],
  });
  return { questions: jsonText(msg), stats: stats(SMALL_MODEL, msg.usage, started) };
}
