import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { AppError } from "@/server/errors";
import { removeAvatar, setAvatar } from "@/server/services/avatar";

/** POST multipart `file` → sets the profile photo. DELETE → back to the initial. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit("upload", user.id);
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION", "No file");
  return { url: await setAvatar(user, file) };
});

export const DELETE = handler(async () => {
  const user = await requireUser();
  await removeAvatar(user);
  return { ok: true };
});
