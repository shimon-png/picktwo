import { eq } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { db } from "../db";
import { users, type User } from "../db/schema";
import { AppError } from "../errors";
import { createId } from "@/lib/id";

const MAX = 2 * 1024 * 1024; // the client crops to 512px JPEG first, so real uploads are ~50 KB
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const isOurBlob = (url: string | null): url is string => !!url && url.includes(".blob.vercel-storage.com/avatars/");

/** Replaces the user's profile photo. Removes the previous one from Blob storage when we stored it. */
export async function setAvatar(user: User, file: File): Promise<string> {
  if (!TYPES.includes(file.type)) throw new AppError("VALIDATION", "Please upload a JPG, PNG or WebP image");
  if (file.size > MAX) throw new AppError("VALIDATION", "That image is too large");
  let url: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const ext = file.type.split("/")[1];
    url = (await put(`avatars/${user.id}-${createId()}.${ext}`, file, { access: "public", contentType: file.type })).url;
  } else {
    // Dev fallback without Vercel Blob: small inline data URL.
    if (file.size > 300_000) throw new AppError("VALIDATION", "Image too large — connect Vercel Blob for bigger uploads");
    url = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  await db.update(users).set({ image: url }).where(eq(users.id, user.id));
  if (isOurBlob(user.image) && process.env.BLOB_READ_WRITE_TOKEN) await del(user.image).catch(() => {});
  return url;
}

export async function removeAvatar(user: User) {
  await db.update(users).set({ image: null }).where(eq(users.id, user.id));
  if (isOurBlob(user.image) && process.env.BLOB_READ_WRITE_TOKEN) await del(user.image).catch(() => {});
}
