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
    const color = side === "A" ? "#2BD2FF" : "#FF3CAC";
    const soft = side === "A" ? "#173A52" : "#4A1840";
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
        <div style={{ position: "absolute", left: 20, top: 20, width: 64, height: 64, borderRadius: 32, background: color, color: "#120E26", fontSize: 36, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {side}
        </div>
      </div>
    );
  };
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#120E26", padding: 48, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 700, color: "#FFFFFF", letterSpacing: -1 }}>
            <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
              <circle cx="14" cy="29" r="9.5" stroke="#2BD2FF" strokeWidth="3.4" />
              <circle cx="17.5" cy="27" r="3.6" fill="#2BD2FF" />
              <circle cx="34" cy="29" r="9.5" stroke="#FF3CAC" strokeWidth="3.4" />
              <circle cx="37.5" cy="27" r="3.6" fill="#FF3CAC" />
              <circle cx="29" cy="10" r="2.3" fill="#C6FF3D" />
              <circle cx="34" cy="7.5" r="2.3" fill="#C6FF3D" />
              <circle cx="39" cy="10" r="2.3" fill="#C6FF3D" />
            </svg>
            <span style={{ display: "flex" }}>
              crowdpick<span style={{ color: "#2BD2FF" }}>.ai</span>
            </span>
          </div>
          <div style={{ fontSize: 28, color: "#C6FF3D" }}>Tap to vote →</div>
        </div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, marginTop: 12, color: "#C6FF3D", lineClamp: 1 }}>{title.slice(0, 60)}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
          {tile(A, "A")}
          <div style={{ fontSize: 48, fontWeight: 800, color: "#C6FF3D" }}>vs</div>
          {tile(B, "B")}
        </div>
      </div>
    ),
    size,
  );
}
