/**
 * Ad-platform tags. X (Twitter) pixel: the base code loads on every page (so X can attribute visits to ads) and the
 * sign-up conversion event fires once, on the first page load after someone finishes sign-up.
 * Override with env vars; set NEXT_PUBLIC_X_PIXEL_ID="" to turn the X pixel off.
 */
export const X_PIXEL_ID = process.env.NEXT_PUBLIC_X_PIXEL_ID ?? "rjz70";
export const X_SIGNUP_EVENT_ID = process.env.NEXT_PUBLIC_X_SIGNUP_EVENT_ID ?? "tw-rjz70-rjz74";

/** Set by the server when sign-up finishes; read (and cleared) by <XPixel/> to fire the conversion exactly once. */
export const SIGNUP_CONVERSION_COOKIE = "cp_conv_signup";
