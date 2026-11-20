import { createHash, randomInt } from "node:crypto";

/** Pure helpers for sign-in codes (no DB), so they can be unit tested. */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** A 6-digit numeric code (leading zeros allowed). */
export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashCode(email: string, code: string, secret = process.env.AUTH_SECRET || "dev-secret") {
  return createHash("sha256").update(`${normalizeEmail(email)}:${code.trim()}:${secret}`).digest("hex");
}

/** Base handle from an email: letters, digits, underscores, 3–20 chars. */
export function handleBase(email: string | null): string {
  let h = (email?.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15);
  if (h.length < 3) h = `user${h}`;
  return h;
}
