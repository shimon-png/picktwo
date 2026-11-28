/**
 * Small server-rendered charts for the Brain (plain SVG, no library). Colours are theme tokens: A blue for the main
 * line, B pink for benchmarks and the second series (bright rule, Nov 26 2026).
 */
import Link from "next/link";

const A = "var(--color-a)";
const B = "var(--color-b)";

/** A 14-day line for a tile. Nulls leave gaps. `bench` draws a dashed reference line (e.g. the 80% bounce mark). */
export function Sparkline({ values, bench, label }: { values: (number | null)[]; bench?: number; label: string }) {
  const W = 140, H = 36, pad = 3;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <div className="h-9 text-[11px] text-zinc-500">Not enough days yet</div>;
  const all = bench == null ? nums : [...nums, bench];
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  let d = "";
  values.forEach((v, i) => {
    if (v == null) return;
    d += `${d && values[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
  });
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full" role="img" aria-label={label} preserveAspectRatio="none">
      {bench != null && <line x1={pad} x2={W - pad} y1={y(bench)} y2={y(bench)} stroke={B} strokeWidth="1.2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
      <path d={d} fill="none" stroke={A} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {values.at(-1) != null && <circle cx={x(last)} cy={y(values.at(-1)!)} r="2.5" fill={A} />}
    </svg>
  );
}

/**
 * Day by day as a line (oldest left), with the 7-day rolling average on top so daily noise doesn't hide the trend.
 * The last point (today) is drawn hollow: the day isn't over.
 */
export function TrendChart({ points, fmt, label }: { points: { day: string; value: number | null; href?: string }[]; fmt: (v: number) => string; label: string }) {
  const W = 720, H = 220, L = 48, R = 12, T = 14, Bm = 28;
  const nums = points.map((p) => p.value).filter((v): v is number => v != null);
  if (nums.length < 2) return <p className="text-sm text-zinc-500">Not enough days yet.</p>;
  const lo = Math.min(0, ...nums), hi = Math.max(...nums) || 1;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - Bm);
  const avg = points.map((_, i) => {
    const win = points.slice(Math.max(0, i - 6), i + 1).map((p) => p.value).filter((v): v is number => v != null);
    return i >= 2 && win.length ? win.reduce((a, b) => a + b, 0) / win.length : null;
  });
  const path = (vals: (number | null)[]) => {
    let d = "";
    vals.forEach((v, i) => {
      if (v == null) return;
      d += `${d && vals[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    });
    return d;
  };
  const ticks = [lo, (lo + hi) / 2, hi];
  const every = Math.ceil(points.length / 8);
  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-ink/10" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="text-zinc-500">
              {fmt(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % every === 0 || i === points.length - 1 ? (
            <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor" className="text-zinc-500">
              {p.day.slice(5)}
            </text>
          ) : null,
        )}
        <path d={path(avg)} fill="none" stroke={B} strokeWidth="2" strokeDasharray="5 4" />
        <path d={path(points.map((p) => p.value))} fill="none" stroke={A} strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => {
          if (p.value == null) return null;
          const today = i === points.length - 1;
          const dot = <circle cx={x(i)} cy={y(p.value)} r={today ? 4 : 3} fill={today ? "var(--color-white, white)" : A} stroke={A} strokeWidth="2" />;
          return (
            <g key={p.day}>
              <title>{`${p.day}: ${fmt(p.value)}`}</title>
              {p.href ? <Link href={p.href}>{dot}</Link> : dot}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
        <span>
          <span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: A }} /> Each day (hollow = today so far)
        </span>
        <span>
          <span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed align-middle" style={{ borderColor: B }} /> 7-day average
        </span>
      </div>
    </div>
  );
}

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
