import { put } from "@vercel/blob";
import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { AppError } from "@/server/errors";
import { createId } from "@/lib/id";

const MAX = 4 * 1024 * 1024; // images are resized client-side (≤1600px) before upload
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit("upload", user.id);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "No file");
  if (!TYPES.includes(file.type)) throw new AppError("VALIDATION", "Please upload a JPG, PNG or WebP image");
  if (file.size > MAX) throw new AppError("VALIDATION", "That image is too large (max 10 MB before resizing)");
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const ext = file.type.split("/")[1];
    const blob = await put(`battles/${createId()}.${ext}`, file, { access: "public", contentType: file.type });
    return { url: blob.url };
  }
  // Fallback without Vercel Blob: inline data URL (fine for dev / small deployments).
  if (file.size > 1_500_000) throw new AppError("VALIDATION", "Image too large — connect Vercel Blob for bigger uploads");
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return { url: `data:${file.type};base64,${b64}` };
});
