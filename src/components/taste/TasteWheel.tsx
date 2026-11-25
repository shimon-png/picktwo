import { radarPoints, TASTE_AXES } from "@/lib/taste-profile";

type Axis = { id: string; score: number; crowd?: number };

/**
 * Six-axis taste wheel (About-you plan §4). Lime = this person, dashed ring = the average voter. Axes not unlocked
 * yet sit on the middle ring, labels dimmed.
 */
export function TasteWheel({ axes, size = 220, showCrowd = true }: { axes: Axis[]; size?: number; showCrowd?: boolean }) {
  const byId = new Map(axes.map((a) => [a.id, a]));
  const order = TASTE_AXES.map((a) => byId.get(a.id));
  const ring = (k: number) => radarPoints(TASTE_AXES.map(() => k * 2 - 1)).map((p) => p.join(",")).join(" ");
  const me = radarPoints(order.map((a) => a?.score ?? 0));
  const crowd = radarPoints(order.map((a) => a?.crowd ?? 0));
  const labels = radarPoints(TASTE_AXES.map(() => 1), 100, 100, 92);
  return (
    <svg viewBox="-46 -12 292 224" width={size} height={size} role="img" aria-label={`Taste wheel: ${TASTE_AXES.map((a, i) => `${a.left} ${Math.round(((order[i]?.score ?? 0) + 1) * 50)}%`).join(", ")}`}>
      <g fill="none" stroke="currentColor" strokeOpacity={0.18}>
        <polygon points={ring(1)} />
        <polygon points={ring(0.66)} />
        <polygon points={ring(0.33)} />
      </g>
      {showCrowd && <polygon points={crowd.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeDasharray="3 3" />}
      <polygon points={me.map((p) => p.join(",")).join(" ")} fill="rgba(198,255,61,.22)" stroke="#c6ff3d" strokeWidth={2} />
      {me.map(([x, y], i) => (order[i] ? <circle key={i} cx={x} cy={y} r={2.6} fill="#c6ff3d" /> : null))}
      {TASTE_AXES.map((a, i) => {
        const [x, y] = labels[i];
        const anchor = Math.abs(x - 100) < 4 ? "middle" : x > 100 ? "start" : "end";
        return (
          <text key={a.id} x={x} y={y + (y < 100 ? -2 : 8)} textAnchor={anchor} fontSize={10} fontWeight={600} fill="currentColor" fillOpacity={order[i] ? 0.85 : 0.35}>
            {a.left}
          </text>
        );
      })}
    </svg>
  );
}
