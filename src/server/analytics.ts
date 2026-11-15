import { db } from "./db";
import { analyticsEvents } from "./db/schema";

export function track(name: string, props: Record<string, unknown> = {}, ids: { userId?: string | null; deviceId?: string | null } = {}) {
  // Fire-and-forget; analytics must never break a request.
  db.insert(analyticsEvents)
    .values({ name, props, userId: ids.userId ?? null, deviceId: ids.deviceId ?? null })
    .catch((e) => console.error("[analytics]", e));
}
