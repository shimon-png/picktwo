import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { AppError } from "./errors";

type Rule = { limit: number; windowSec: number };

export const RULES = {
  vote: { limit: 60, windowSec: 60 },
  voteIpHour: { limit: 600, windowSec: 3600 },
  createBattleHour: { limit: 10, windowSec: 3600 },
  createBattleDay: { limit: 30, windowSec: 86400 },
  reason: { limit: 30, windowSec: 60 },
  unfurl: { limit: 20, windowSec: 60 },
  upload: { limit: 30, windowSec: 3600 },
  report: { limit: 10, windowSec: 3600 },
  generic: { limit: 60, windowSec: 60 },
} satisfies Record<string, Rule>;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;
const limiters = new Map<string, Ratelimit>();

// In-memory fallback (per serverless instance — fine for dev and low traffic).
const mem = new Map<string, { count: number; reset: number }>();

export async function rateLimit(rule: keyof typeof RULES, key: string) {
  const r = RULES[rule];
  if (redis) {
    let l = limiters.get(rule);
    if (!l) {
      l = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(r.limit, `${r.windowSec} s`), prefix: `pt:${rule}` });
      limiters.set(rule, l);
    }
    const { success } = await l.limit(key);
    if (!success) throw new AppError("RATE_LIMITED", "Slow down a little — try again in a moment.");
    return;
  }
  const k = `${rule}:${key}`;
  const now = Date.now();
  const e = mem.get(k);
  if (!e || e.reset < now) {
    mem.set(k, { count: 1, reset: now + r.windowSec * 1000 });
    if (mem.size > 50_000) mem.clear();
    return;
  }
  e.count++;
  if (e.count > r.limit) throw new AppError("RATE_LIMITED", "Slow down a little — try again in a moment.");
}
