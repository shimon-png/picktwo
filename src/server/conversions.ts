import { cookies } from "next/headers";
import { createId } from "@/lib/id";
import { SIGNUP_CONVERSION_COOKIE } from "@/lib/marketing";

/**
 * Mark that this browser just finished sign-up. The next page load fires the ad-platform sign-up events
 * (see <XPixel/>). The value is a random id that ad platforms use to de-duplicate the conversion.
 * Call from route handlers only, when onboarding completes for the first time.
 */
export async function markSignupConversion() {
  (await cookies()).set(SIGNUP_CONVERSION_COOKIE, createId(), {
    path: "/",
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // read by the pixel component in the browser
  });
}
