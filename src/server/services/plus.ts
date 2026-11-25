/**
 * Pickbot Plus (PRD §12): $4.99/month for unlimited Pickbot answers and more crowd posts a day. Stripe Checkout +
 * Billing Portal over Stripe's REST API (no SDK). `user.plus_until` is the single source of truth, kept in sync by
 * the webhook (`/api/stripe/webhook`). Needs STRIPE_SECRET_KEY, STRIPE_PLUS_PRICE_ID and STRIPE_WEBHOOK_SECRET; with
 * any missing, the Plus page says "coming soon". Pure rules in plus-rules.ts (tested).
 */
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, type User } from "../db/schema";
import { AppError } from "../errors";
import { track } from "../analytics";
import { appUrl } from "@/lib/utils";
import { plusUntilFrom, verifyStripeSignature, type StripeSubscription } from "./plus-rules";

export const plusConfigured = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PLUS_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET);

async function stripe<T>(path: string, form: Record<string, string> = {}, method: "POST" | "GET" | "DELETE" = "POST"): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? new URLSearchParams(form) : undefined,
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error("[stripe]", path, j.error?.message);
    throw new AppError("UNAVAILABLE", "Payments are having a moment. Please try again.");
  }
  return j;
}

/** Start a Stripe Checkout for Plus; returns the page to send the person to. */
export async function plusCheckout(user: User) {
  if (!plusConfigured()) throw new AppError("UNAVAILABLE", "Pickbot Plus is coming soon.");
  const form: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": process.env.STRIPE_PLUS_PRICE_ID!,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    "subscription_data[metadata][userId]": user.id,
    success_url: appUrl("/plus?welcome=1"),
    cancel_url: appUrl("/plus"),
    allow_promotion_codes: "true",
  };
  if (user.stripeCustomerId) form.customer = user.stripeCustomerId;
  else if (user.email) form.customer_email = user.email;
  const s = await stripe<{ url: string }>("checkout/sessions", form);
  track("plus_checkout_started", {}, { userId: user.id });
  return { url: s.url };
}

/** Stripe's page to change card, see invoices or cancel. */
export async function plusPortal(user: User) {
  if (!plusConfigured() || !user.stripeCustomerId) throw new AppError("CONFLICT", "No subscription to manage.");
  const s = await stripe<{ url: string }>("billing_portal/sessions", { customer: user.stripeCustomerId, return_url: appUrl("/plus") });
  return { url: s.url };
}

/** Account deletion: cancel any live Plus subscription right away. Never throws (deletion must go through). */
export async function cancelPlus(user: User) {
  if (!process.env.STRIPE_SECRET_KEY || !user.stripeCustomerId) return;
  try {
    const subs = await stripe<{ data: { id: string; status: string }[] }>(`subscriptions?customer=${encodeURIComponent(user.stripeCustomerId)}&status=all&limit=10`, {}, "GET");
    for (const s of subs.data.filter((x) => !["canceled", "incomplete_expired"].includes(x.status))) await stripe(`subscriptions/${s.id}`, {}, "DELETE");
  } catch (e) {
    console.error("[stripe] cancel on delete", e);
  }
}

type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/** Webhook: checkout done (link the customer), subscription created / updated / deleted (set plus_until). */
export async function handleStripeWebhook(payload: string, signature: string | null) {
  if (!verifyStripeSignature(payload, signature, process.env.STRIPE_WEBHOOK_SECRET ?? "")) throw new AppError("FORBIDDEN", "Bad signature");
  const ev = JSON.parse(payload) as StripeEvent;
  const o = ev.data.object;
  if (ev.type === "checkout.session.completed") {
    const userId = String(o.client_reference_id ?? "");
    const customer = String(o.customer ?? "");
    if (userId && customer) await db.update(users).set({ stripeCustomerId: customer }).where(eq(users.id, userId));
    return { handled: ev.type };
  }
  if (ev.type.startsWith("customer.subscription.")) {
    const customer = String(o.customer ?? "");
    const metaUser = (o.metadata as Record<string, string> | undefined)?.userId;
    const [u] = metaUser
      ? await db.select().from(users).where(eq(users.id, metaUser))
      : await db.select().from(users).where(eq(users.stripeCustomerId, customer));
    if (!u) return { handled: "no_user" };
    const sub = o as unknown as StripeSubscription;
    const until = ev.type === "customer.subscription.deleted" ? new Date() : plusUntilFrom(sub);
    await db.update(users).set({ plusUntil: until, stripeCustomerId: u.stripeCustomerId ?? (customer || null) }).where(eq(users.id, u.id));
    track("plus_subscription", { event: ev.type, status: sub.status, until: until.toISOString() }, { userId: u.id });
    return { handled: ev.type };
  }
  return { handled: "ignored" };
}
