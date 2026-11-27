import { ImageResponse } from "next/og";
import { getViewer } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { tasteProfileFor } from "@/server/services/taste-profile";
import { radarPoints, TASTE_AXES, lean } from "@/lib/taste-profile";

/**
 * The 9:16 taste card for stories (About-you plan §4). Only for the signed-in owner, and it never shows age, sex or
 * location: the type name, the wheel, the person's top leans and how often they went against the crowd.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer.user) return new Response("Sign in", { status: 401 });
  await rateLimit("generic", `tastecard:${viewer.user.id}`);
  const t = await tasteProfileFor(viewer);
  if (!t || t.axes.length < 6) return new Response("Not unlocked yet", { status: 404 });
  const byId = new Map(t.axes.map((a) => [a.id, a]));
  const pts = radarPoints(TASTE_AXES.map((a) => byId.get(a.id)?.score ?? 0), 300, 300, 240);
  const ring = (k: number) => radarPoints(TASTE_AXES.map(() => k * 2 - 1), 300, 300, 240).map((p) => p.join(",")).join(" ");
  const leans = [...t.axes]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .map((a) => lean(a))
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "110px 90px", background: "linear-gradient(170deg, #2a1d5c 0%, #120e26 55%, #2a0f33 100%)", color: "#eae6ff", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 34, letterSpacing: 6, textTransform: "uppercase", color: "#a29ac9" }}>My taste on crowdpick.ai</div>
        <div style={{ fontSize: 96, fontWeight: 700, color: "#c6ff3d", marginTop: 30, lineHeight: 1.05 }}>{t.name ?? "My taste"}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 70 }}>
          <svg width="600" height="600" viewBox="0 0 600 600">
            <polygon points={ring(1)} fill="none" stroke="#3a3170" strokeWidth="3" />
            <polygon points={ring(0.5)} fill="none" stroke="#3a3170" strokeWidth="3" />
            <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="rgba(198,255,61,0.25)" stroke="#c6ff3d" strokeWidth="7" />
          </svg>
        </div>
        <div style={{ fontSize: 44, marginTop: 70 }}>{leans ? `Leans ${leans.toLowerCase()}` : ""}</div>
        <div style={{ fontSize: 36, marginTop: 20, color: "#a29ac9" }}>{t.settled ? `Went against the crowd ${t.against} times out of ${t.settled}` : ""}</div>
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "center", background: "#c6ff3d", color: "#120e26", borderRadius: 999, padding: "34px 0", fontSize: 44, fontWeight: 700 }}>
          What&apos;s yours? crowdpick.ai
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, fontSize: 32, color: "#a29ac9" }}>
          <span>{viewer.user.handle ? `@${viewer.user.handle}` : ""}</span>
          <span>crowdpick</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store" } },
  );
}
