import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { battles, options } from "@/server/db/schema";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "crowdpick.ai battle";

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [b] = await db.select().from(battles).where(eq(battles.slug, slug));
  const opts = b && b.visibility !== "FRIENDS" && b.status !== "HIDDEN" && b.status !== "DELETED" ? await db.select().from(options).where(eq(options.battleId, b.id)) : [];
  const A = opts.find((o) => o.side === "A");
  const B = opts.find((o) => o.side === "B");
  const title = A ? b!.title : "Help me choose";
  const img = (o?: typeof A) => {
    const src = o?.imageUrl || o?.urlImage;
    return src && (src.startsWith("https://") || src.startsWith("data:image/png") || src.startsWith("data:image/jpeg")) ? src : null;
  };
  const tile = (o: typeof A, side: "A" | "B") => {
    const color = side === "A" ? "#3170E8" : "#E5484D";
    const soft = side === "A" ? "#EAF1FD" : "#FDECEC";
    const src = img(o);
    return (
      <div style={{ display: "flex", flexDirection: "column", width: 500, height: 400, borderRadius: 28, background: soft, border: `4px solid ${color}`, overflow: "hidden", position: "relative" }}>
        {src ? (
          <img src={src} width={500} height={400} style={{ objectFit: "cover", width: "100%", height: "100%" }} alt="" />
        ) : (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: 32, fontSize: 52, fontWeight: 800, color, textAlign: "center" }}>
            {o?.label ?? side}
          </div>
        )}
        <div style={{ position: "absolute", left: 20, top: 20, width: 64, height: 64, borderRadius: 32, background: color, color: "white", fontSize: 36, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {side}
        </div>
      </div>
    );
  };
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", padding: 48, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 500, color: "#1A1F2E", letterSpacing: -1 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="7" cy="14.5" r="4.8" stroke="#8A90A2" strokeWidth="1.6" />
              <circle cx="17" cy="14.5" r="4.8" stroke="#3170E8" strokeWidth="1.6" />
              <circle cx="17" cy="14.5" r="1.9" fill="#3170E8" />
              <circle cx="13.6" cy="5.2" r="1.25" fill="#E5484D" />
              <circle cx="17" cy="4" r="1.25" fill="#E5484D" />
              <circle cx="20.4" cy="5.2" r="1.25" fill="#E5484D" />
            </svg>
            <span style={{ display: "flex" }}>
              crowdpick<span style={{ color: "#3170E8" }}>.ai</span>
            </span>
          </div>
          <div style={{ fontSize: 28, color: "#71717a" }}>Tap to vote →</div>
        </div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 500, marginTop: 12, color: "#1A1F2E", lineClamp: 1 }}>{title.slice(0, 60)}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
          {tile(A, "A")}
          <div style={{ fontSize: 48, fontWeight: 800, color: "#a1a1aa" }}>vs</div>
          {tile(B, "B")}
        </div>
      </div>
    ),
    size,
  );
}
