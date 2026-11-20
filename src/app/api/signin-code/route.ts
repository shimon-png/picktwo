import { z } from "zod";
import { handler, clientIp } from "@/server/api";
import { rateLimit } from "@/server/ratelimit";
import { normalizeEmail, requestSigninCode } from "@/server/services/signin-code";

const input = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200) });

/** Step 1 of sign-in / sign-up: email a 6-digit code. */
export const POST = handler(async (req) => {
  await rateLimit("signinCodeIp", await clientIp());
  const { email } = input.parse(await req.json());
  await rateLimit("signinCodeEmail", normalizeEmail(email));
  return { ok: true, ...(await requestSigninCode(email)) };
});
