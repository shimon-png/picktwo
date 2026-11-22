import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { createHash } from "node:crypto";
import { auth } from "./auth";
import { db } from "./db";
import { users, type User } from "./db/schema";
import { AppError } from "./errors";

export const DEVICE_COOKIE = "pt_vid";

/** Current signed-in user (fresh from DB) or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || u.bannedAt) return null;
  return u;
});

export async function getDeviceId(): Promise<string | null> {
  const c = await cookies();
  return c.get(DEVICE_COOKIE)?.value ?? null;
}

export async function getViewer() {
  const [user, deviceId] = await Promise.all([getCurrentUser(), getDeviceId()]);
  return { user, deviceId };
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new AppError("UNAUTHORIZED", "Please sign in first");
  return u;
}

/**
 * Built-in admins (Alex and Shimon), stored as SHA-256 of the lowercased email so the addresses
 * aren't published in the repo. Works on top of the `ADMIN` role and `ADMIN_EMAILS`.
 */
const BUILT_IN_ADMIN_HASHES = new Set([
  "5e9f440b7e914675cde69f6c438249f74dd116c60c2b932db5b6cd50cddc741b",
  "4ce333e403d5ae4355cb28d924f03aad5c2689274b255442803022e6e5469f15",
  "03a2f7eafc5cce85cb859f0f44dbdd572f3658afb5d4fc463451203771c554b2",
]);

export function isBuiltInAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return BUILT_IN_ADMIN_HASHES.has(createHash("sha256").update(email.trim().toLowerCase()).digest("hex"));
}

export function isAdmin(u: User | null) {
  if (!u) return false;
  if (u.role === "ADMIN") return true;
  if (isBuiltInAdminEmail(u.email)) return true;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!u.email && admins.includes(u.email.toLowerCase());
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!isAdmin(u)) throw new AppError("NOT_FOUND", "Not found");
  return u;
}
