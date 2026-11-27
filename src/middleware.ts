import { NextResponse, type NextRequest } from "next/server";

const DEVICE_COOKIE = "pt_vid";

/** Assigns every visitor an anonymous device id (random 128-bit) so they can vote without an account. */
export function middleware(req: NextRequest) {
  if (req.cookies.get(DEVICE_COOKIE)) return NextResponse.next();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = "d_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  // Make it visible to this request's server code too
  const headers = new Headers(req.headers);
  const existing = req.headers.get("cookie");
  headers.set("cookie", (existing ? existing + "; " : "") + `${DEVICE_COOKIE}=${id}`);
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
