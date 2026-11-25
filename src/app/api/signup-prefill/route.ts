import { handler } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { enabledProviders } from "@/server/auth";
import { signupPrefill } from "@/server/services/about";

/** One-tap sign-up card: what we can fill in for this guest, and whether Google sign-in is available. */
export const GET = handler(async () => {
  const viewer = await getViewer();
  await rateLimit("generic", `prefill:${viewer.deviceId ?? "anon"}`);
  return { ...(await signupPrefill(viewer.deviceId)), google: enabledProviders.google };
});
