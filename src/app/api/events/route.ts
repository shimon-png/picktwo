import { headers } from "next/headers";
import { handler, clientIp } from "@/server/api";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { clientEventsInput } from "@/lib/validators";
import { logClientEvents } from "@/server/analytics";
import { geoFromHeaders } from "@/server/services/passive-rules";

/**
 * Data-brain client events (lib/events.ts). The browser says what it showed; the server stamps who,
 * which device and the time, then appends to analytics_event. Duplicate event ids are ignored.
 */
export const POST = handler(async (req) => {
  const viewer = await getViewer();
  await rateLimit("events", viewer.user?.id ?? viewer.deviceId ?? "anon");
  await rateLimit("eventsIpHour", await clientIp());
  let raw: unknown = {};
  try {
    raw = JSON.parse(await req.text());
  } catch {}
  const input = clientEventsInput.parse(raw);
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  // Vercel's IP geolocation (country, state, city, ZIP): metro-level guesses, stored on session_start + the device.
  const geo = geoFromHeaders((n) => h.get(n));
  await logClientEvents(input.events, { userId: viewer.user?.id ?? null, deviceId: viewer.deviceId, userAgent: ua, geo });
  return { ok: true };
});
