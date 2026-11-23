import { db } from "./db";
import { analyticsEvents } from "./db/schema";
import { isBotUserAgent, profileDiff, type ProfileFields } from "@/lib/analytics-rules";

export function track(name: string, props: Record<string, unknown> = {}, ids: { userId?: string | null; deviceId?: string | null } = {}) {
  // Fire-and-forget; analytics must never break a request.
  db.insert(analyticsEvents)
    .values({ name, props, userId: ids.userId ?? null, deviceId: ids.deviceId ?? null })
    .catch((e) => console.error("[analytics]", e));
}

/** Version of the client event format; bump when an event's meaning changes (docs/brain/data-dictionary.md). */
export const CLIENT_EVENT_VERSION = 1;

export type ClientEvent = { id: string; name: string; at: number; sessionId: string; seq: number; props: Record<string, unknown> };

/**
 * Append a batch of browser events in one insert. Identity and server time come from the request, never the
 * client; the client's id makes resends harmless (ON CONFLICT DO NOTHING).
 */
export async function logClientEvents(events: ClientEvent[], ctx: { userId: string | null; deviceId: string | null; userAgent: string }) {
  if (!events.length) return;
  const bot = isBotUserAgent(ctx.userAgent);
  const rows = events.map((e) => ({
    id: `c_${e.id}`,
    name: e.name,
    userId: ctx.userId,
    deviceId: ctx.deviceId,
    props: {
      ...e.props,
      sessionId: e.sessionId,
      seq: e.seq,
      clientAt: new Date(e.at).toISOString(),
      v: CLIENT_EVENT_VERSION,
      ...(bot ? { bot: true } : {}),
      ...(e.name === "session_start" ? { ua: ctx.userAgent.slice(0, 300) } : {}),
    },
  }));
  try {
    await db.insert(analyticsEvents).values(rows).onConflictDoNothing();
  } catch (e) {
    console.error("[analytics] client events", e);
  }
}

/**
 * Demographics are stored as current values only, so every change is kept as a `profile_changed` event
 * (old and new value per field). `via` says which screen saved it. See docs/brain/data-dictionary.md.
 */
export function trackProfileChanges(userId: string, before: ProfileFields, after: ProfileFields, via: string) {
  const changes = profileDiff(before, after);
  if (Object.keys(changes).length) track("profile_changed", { via, changes }, { userId });
}
