/**
 * Minimal flow (Sankey) diagram in plain SVG, server-rendered, no library. Columns left to right; each node's
 * height is its count; links are bands whose width is the number of people moving between two nodes.
 */
export type SankeyNode = { id: string; col: number; label: string; value: number; tone: "grey" | "green" | "red" | "blue" };
export type SankeyLink = { from: string; to: string; value: number; tone: "grey" | "green" | "red" | "blue" };

const FILL: Record<SankeyNode["tone"], string> = {
  grey: "var(--color-zinc-400, #a1a1aa)",
  green: "var(--color-green, #16a34a)",
  red: "var(--color-b, #e8384f)",
  blue: "var(--color-a, #2f5ff0)",
};

export function Sankey({ nodes, links, height = 480 }: { nodes: SankeyNode[]; links: SankeyLink[]; height?: number }) {
  const W = 1000, NODE_W = 12, GAP = 34, PAD_T = 12;
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  const colX = (c: number) => 8 + (c * (W - 230)) / Math.max(1, cols - 1);
  const byCol = Array.from({ length: cols }, (_, c) => nodes.filter((n) => n.col === c && n.value > 0));
  const maxTotal = Math.max(1, ...byCol.map((ns) => ns.reduce((a, n) => a + n.value, 0) + GAP * 0));
  const maxCount = Math.max(...byCol.map((ns) => ns.length));
  const k = (height - PAD_T * 2 - GAP * (maxCount - 1)) / maxTotal;
  const pos = new Map<string, { x: number; y: number; h: number; outY: number; inY: number }>();
  for (const ns of byCol) {
    let y = PAD_T;
    for (const n of ns) {
      const h = Math.max(2, n.value * k);
      pos.set(n.id, { x: colX(n.col), y, h, outY: y, inY: y });
      y += h + GAP;
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Customer journey flow">
      {links
        .filter((l) => l.value > 0 && pos.has(l.from) && pos.has(l.to))
        .map((l, i) => {
          const a = pos.get(l.from)!, b = pos.get(l.to)!;
          const w = Math.max(1, l.value * k);
          const x0 = a.x + NODE_W, x1 = b.x, y0 = a.outY + w / 2, y1 = b.inY + w / 2;
          a.outY += w;
          b.inY += w;
          const mx = (x0 + x1) / 2;
          return (
            <path
              key={i}
              d={`M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`}
              fill="none"
              stroke={FILL[l.tone]}
              strokeOpacity={0.28}
              strokeWidth={w}
            >
              <title>{`${l.value} people`}</title>
            </path>
          );
        })}
      {nodes
        .filter((n) => pos.has(n.id))
        .map((n) => {
          const p = pos.get(n.id)!;
          return (
            <g key={n.id}>
              <rect x={p.x} y={p.y} width={NODE_W} height={p.h} fill={FILL[n.tone]} rx={2} />
              <text
                x={p.x + NODE_W + 6}
                y={p.y + Math.min(p.h / 2, 18) + 7}
                fontSize={22}
                className="fill-current"
                stroke="rgba(0,0,0,0.55)"
                strokeWidth={4}
                paintOrder="stroke"
              >
                <tspan fontWeight={600}>{n.label}</tspan>
                <tspan opacity={0.7}> {n.value}</tspan>
              </text>
            </g>
          );
        })}
    </svg>
  );
}
