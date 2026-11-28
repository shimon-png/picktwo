/**
 * Small server-rendered charts (hover charts with dots are in charts-client.tsx) for the Brain (plain SVG, no library). Colours are theme tokens: A blue for the main
 * line, B pink for benchmarks and the second series (bright rule, Nov 26 2026).
 */

const A = "var(--color-a)";

/** Ranked horizontal bars (engagement score): label left, bar to scale, value right. */
export function RankBars({ rows, max }: { rows: { key: string; label: React.ReactNode; value: number; display: string; sub?: string }[]; max?: number }) {
  if (!rows.length) return <p className="text-sm text-zinc-500">No data yet.</p>;
  const top = max ?? Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <ol className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_minmax(80px,40%)_3rem] items-center gap-2 text-sm">
          <div className="min-w-0">
            {r.label}
            {r.sub && <div className="text-[11px] text-zinc-500">{r.sub}</div>}
          </div>
          <div className="h-3 rounded-full bg-ink/5">
            <div className="h-3 rounded-full" style={{ width: `${Math.max(2, (100 * r.value) / top)}%`, background: A }} />
          </div>
          <div className="text-right tabular-nums">{r.display}</div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Themes on two axes: vote rate across, skip rate down (low skip at the top), so up and right is better on both.
 * The shaded corner past both dashed averages = people vote and don't skip (post more). Dot size = cards seen.
 * Labels that would overlap an earlier one are left to the hover title.
 */
export function ThemeDots({ dots, avgVote, avgSkip }: { dots: { key: string; label: string; vote: number; skip: number; seen: number }[]; avgVote: number | null; avgSkip: number | null }) {
  const W = 720, H = 320, L = 44, R = 90, T = 16, Bm = 36;
  if (!dots.length) return <p className="text-sm text-zinc-500">No data yet.</p>;
  const votes = dots.map((d) => d.vote), skips = dots.map((d) => d.skip);
  let vLo = Math.min(...votes) - 0.03, vHi = Math.max(...votes) + 0.03;
  if (vHi - vLo < 0.1) [vLo, vHi] = [(vLo + vHi) / 2 - 0.05, (vLo + vHi) / 2 + 0.05];
  if (vHi > 1) [vLo, vHi] = [vLo - (vHi - 1), 1];
  if (vLo < 0) vLo = 0;
  const sHi = Math.max(0.05, Math.max(...skips) + 0.03);
  const x = (v: number) => L + ((v - vLo) / (vHi - vLo)) * (W - L - R);
  const y = (s: number) => T + (s / sHi) * (H - T - Bm);
  const maxSeen = Math.max(...dots.map((d) => d.seen), 1);
  const r = (n: number) => 5 + 12 * Math.sqrt(n / maxSeen);
  const pctL = (v: number) => `${Math.round(v * 100)}%`;
  const placed: { x: number; y: number }[] = [];
  const labelOk = (lx: number, ly: number) => {
    if (placed.some((p) => Math.abs(p.y - ly) < 13 && Math.abs(p.x - lx) < 80)) return false;
    placed.push({ x: lx, y: ly });
    return true;
  };
  const sorted = [...dots].sort((a, b) => b.seen - a.seen);
  const ax = avgVote == null ? null : Math.min(Math.max(x(avgVote), L), W - R);
  const ay = avgSkip == null ? null : Math.min(Math.max(y(avgSkip), T), H - Bm);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Themes by vote rate and skip rate">
      {ax != null && ay != null && <rect x={ax} y={T} width={W - R - ax} height={ay - T} fill="var(--color-green)" opacity="0.12" />}
      {ax != null && <line x1={ax} x2={ax} y1={T} y2={H - Bm} stroke="currentColor" className="text-ink/30" strokeDasharray="4 4" />}
      {ay != null && <line x1={L} x2={W - R} y1={ay} y2={ay} stroke="currentColor" className="text-ink/30" strokeDasharray="4 4" />}
      <line x1={L} x2={W - R} y1={H - Bm} y2={H - Bm} stroke="currentColor" className="text-ink/20" />
      <line x1={L} x2={L} y1={T} y2={H - Bm} stroke="currentColor" className="text-ink/20" />
      <text x={W - R} y={H - 10} textAnchor="end" fontSize="11" fill="currentColor" className="text-zinc-500">
        Vote rate → ({pctL(vLo)}–{pctL(vHi)})
      </text>
      <text x={14} y={T} fontSize="11" fill="currentColor" className="text-zinc-500" transform={`rotate(90 14 ${T})`}>
        Skip rate ↓ (0 at top, {pctL(sHi)} at bottom)
      </text>
      {ax != null && (
        <text x={W - R - 6} y={T + 14} textAnchor="end" fontSize="11" fill="currentColor" className="text-green">
          Post more of these
        </text>
      )}
      {sorted.map((d) => {
        const cx = x(d.vote), cy = y(d.skip), rr = r(d.seen);
        const show = labelOk(cx + rr + 4, cy);
        return (
          <g key={d.key}>
            <title>{`${d.label}: vote rate ${pctL(d.vote)}, skip rate ${pctL(d.skip)}, ${d.seen} seen`}</title>
            <circle cx={cx} cy={cy} r={rr} fill={A} fillOpacity="0.22" stroke={A} strokeWidth="1.5" />
            {show && (
              <text x={cx + rr + 4} y={cy + 4} fontSize="11" fill="currentColor">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
