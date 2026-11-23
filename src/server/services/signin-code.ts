import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { emailCodes, users, type User } from "../db/schema";
import { sendEmail, signinCodeEmail } from "../email";
import { AppError } from "../errors";
import { hashCode, newCode, normalizeEmail } from "./signin-code-utils";

export { normalizeEmail };

export const CODE_TTL_MIN = 10;
export const CODE_MAX_ATTEMPTS = 5;

function sameHash(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Creates (or replaces) the email's sign-in code and emails it. Returns the code only in dev mode (no Resend key + DEV_LOGIN). */
export async function requestSigninCode(rawEmail: string): Promise<{ devCode?: string }> {
  const email = normalizeEmail(rawEmail);
  const code = newCode();
  // Keep the previous code working until it expires: a second request (or "Send a new code") shouldn't break the first email.
  const [old] = await db.select().from(emailCodes).where(eq(emailCodes.email, email));
  const keepOld = old && old.expiresAt > new Date();
  const row = {
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
    prevCodeHash: keepOld ? old.codeHash : null,
    prevExpiresAt: keepOld ? old.expiresAt : null,
    attempts: 0,
    createdAt: new Date(),
  };
  await db
    .insert(emailCodes)
    .values({ email, ...row })
    .onConflictDoUpdate({ target: emailCodes.email, set: row });
  await sendEmail({ to: email, ...signinCodeEmail(code, CODE_TTL_MIN) }, { devLog: `Sign-in code for ${email}: ${code}` });
  const dev = !process.env.AUTH_RESEND_KEY && process.env.DEV_LOGIN === "true";
  return dev ? { devCode: code } : {};
}

export type CodeFailure = "invalid" | "expired" | "too_many";

/** Checks a code; on success consumes it and returns the user (created on first sign-in). */
export async function verifySigninCode(rawEmail: string, code: string): Promise<{ user: User } | { error: CodeFailure }> {
  const email = normalizeEmail(rawEmail);
  if (!/^\d{6}$/.test(code.trim())) return { error: "invalid" };
  const [row] = await db.select().from(emailCodes).where(eq(emailCodes.email, email));
  if (!row) return { error: "expired" };
  if (row.expiresAt < new Date()) {
    await db.delete(emailCodes).where(eq(emailCodes.email, email));
    return { error: "expired" };
  }
  if (row.attempts >= CODE_MAX_ATTEMPTS) return { error: "too_many" };
  const h = hashCode(email, code);
  const prevOk = !!row.prevCodeHash && !!row.prevExpiresAt && row.prevExpiresAt > new Date() && sameHash(row.prevCodeHash, h);
  if (!sameHash(row.codeHash, h) && !prevOk) {
    await db.update(emailCodes).set({ attempts: row.attempts + 1 }).where(eq(emailCodes.email, email));
    return { error: row.attempts + 1 >= CODE_MAX_ATTEMPTS ? "too_many" : "invalid" };
  }
  await db.delete(emailCodes).where(eq(emailCodes.email, email));
  let [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u) [u] = await db.insert(users).values({ email, emailVerified: new Date() }).returning();
  else if (!u.emailVerified) await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, u.id));
  if (u.bannedAt) throw new AppError("FORBIDDEN", "This account is not available");
  return { user: u };
}
