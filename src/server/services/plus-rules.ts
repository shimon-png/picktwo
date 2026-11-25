/**
 * Pickbot Plus (PRD phase 4): the pure parts. Stripe webhook signature check and how a subscription maps to
 * `user.plus_until`. Tested in tests/unit/plus-rules.test.ts.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe's `Stripe-Signature` header: `t=<unix>,v1=<hex hmac of "t.payload">[,v1=…]`. Valid when any v1 matches and
 * the timestamp is within `toleranceSec` of now.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length || Math.abs(nowSec - t) > toleranceSec) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s ?? "");
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

export type StripeSubscription = { status: string; current_period_end?: number | null; items?: { data?: { current_period_end?: number | null }[] }; cancel_at_period_end?: boolean };

/**
 * Plus lasts until the end of the paid period while the subscription is active, trialing or past due (Stripe still
 * retries the card); anything else ends it now. A small grace hour covers webhook delays at renewal.
 */
export function plusUntilFrom(sub: StripeSubscription, now = new Date()): Date {
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  if (["active", "trialing", "past_due"].includes(sub.status) && end) return new Date(end * 1000 + 3600_000);
  return now;
}

