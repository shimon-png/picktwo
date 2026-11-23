import { setEmailGroup, UNSUB_GROUPS, verifyUnsubscribe, type UnsubGroup } from "@/server/services/mailer";

/** One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") ?? "";
  const g = url.searchParams.get("g") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!UNSUB_GROUPS.includes(g as UnsubGroup) || !verifyUnsubscribe(u, g, t)) return new Response("Invalid link", { status: 400 });
  await setEmailGroup(u, g as UnsubGroup, false);
  return new Response("Unsubscribed", { status: 200 });
}
