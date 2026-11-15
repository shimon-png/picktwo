import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { cache } from "react";
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

export function isAdmin(u: User | null) {
  if (!u) return false;
  if (u.role === "ADMIN") return true;
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
