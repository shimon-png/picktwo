import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { battles, options } from "@/server/db/schema";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PickTwo battle";

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
    const color = side === "A" ? "#5B5BD6" : "#F2665E";
    const soft = side === "A" ? "#E8E8FB" : "#FDE6E4";
    const src = img(o);
    return (
      <div style={{ display: "flex", flexDirection: "column", width: 500, height: 400, borderRadius: 32, background: soft, border: `6px solid ${color}`, overflow: "hidden", position: "relative" }}>
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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fafafa", padding: 48, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>
            <span style={{ color: "#5B5BD6" }}>Pick</span>
            <span style={{ color: "#F2665E" }}>Two</span>
          </div>
          <div style={{ fontSize: 28, color: "#71717a" }}>Tap to vote →</div>
        </div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 800, marginTop: 12, color: "#18181b", lineClamp: 1 }}>{title.slice(0, 60)}</div>
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
