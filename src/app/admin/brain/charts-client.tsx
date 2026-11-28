"use client";
/**
 * Interactive Brain charts (Alex, Nov 28 2026: "a dot on each day, hover and see the number and the date").
 * Every day is a dot; hovering (or tapping on a phone) shows a tooltip with the date and the numbers. The day-by-day
 * chart holds every metric already, so switching metric is instant (no server round trip, no page jump).
 * Values arrive pre-formatted or with a format key: functions can't cross from the server.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const A = "var(--color-a)";
const B = "var(--color-b)";

export type FmtKey = "int" | "dec1" | "dec2" | "pct0" | "pct1" | "money";
export function fmtBy(k: FmtKey, v: number): string {
  switch (k) {
    case "int":
      return Math.round(v).toLocaleString();
    case "dec1":
      return v.toFixed(1);
    case "dec2":
      return v.toFixed(2);
    case "pct0":
      return `${Math.round(v * 100)}%`;
    case "pct1":
      return `${(v * 100).toFixed(1)}%`;
    case "money": {
      const a = Math.abs(v);
      return `${v < 0 ? "−" : ""}$${a.toFixed(a >= 1 ? 2 : a >= 0.01 ? 3 : 4)}`;
    }
  }
}

const dayLabel = (day: string, long = false) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: long ? "short" : undefined, month: "short", day: "numeric", timeZone: "UTC" });

/** Nearest point index to the pointer, from the wrapper's box. */
function nearest(el: HTMLElement, clientX: number, n: number, left: number, right: number, width: number) {
  const r = el.getBoundingClientRect();
  const fx = ((clientX - r.left) / r.width) * width;
  const i = Math.round(((fx - left) / (width - left - right)) * (n - 1));
  return Math.max(0, Math.min(n - 1, i));
}

function Tip({ xPct, yPct, children }: { xPct: number; yPct: number; children: React.ReactNode }) {
  const side = xPct > 60 ? "right" : xPct < 40 ? "left" : "mid";
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 whitespace-nowrap rounded-lg bg-surface px-2.5 py-1.5 text-[11px] leading-snug text-ink shadow-lift ring-1 ring-ink/10"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: `translate(${side === "right" ? "calc(-100% - 10px)" : side === "left" ? "10px" : "-50%"}, ${side === "mid" ? "calc(-100% - 12px)" : "-50%"})`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A 14-day tile line with a dot per day. Lives inside a tile link: on touch the first tap on a dot shows its numbers
 * instead of opening the link; tapping the same dot again (or anywhere else on the tile) opens it.
 */
export function Sparkline({ values, days, labels, bench, label }: { values: (number | null)[]; days: string[]; labels: (string | null)[]; bench?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const touch = useRef(false);
  const W = 140, H = 40, pad = 4;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <div className="h-10 text-[11px] text-zinc-500">Not enough days yet</div>;
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
  const h = hover != null && values[hover] != null ? hover : null;
  return (
    <div
      className="relative h-10 w-full touch-pan-y"
      onPointerDown={(e) => (touch.current = e.pointerType !== "mouse")}
      onPointerMove={(e) => e.pointerType === "mouse" && setHover(nearest(e.currentTarget, e.clientX, values.length, pad, pad, W))}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
      onClick={(e) => {
        if (!touch.current) return;
        const i = nearest(e.currentTarget, e.clientX, values.length, pad, pad, W);
        if (i !== hover) {
          e.preventDefault();
          e.stopPropagation();
          setHover(i);
        }
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={label} preserveAspectRatio="none">
        {bench != null && <line x1={pad} x2={W - pad} y1={y(bench)} y2={y(bench)} stroke={B} strokeWidth="1.2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        {h != null && <line x1={x(h)} x2={x(h)} y1={0} y2={H} stroke="currentColor" className="text-ink/20" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        <path d={d} fill="none" stroke={A} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Dots are HTML so they stay round while the line stretches to the tile width. */}
      {values.map((v, i) =>
        v == null ? null : (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${(x(i) / W) * 100}%`,
              top: `${(y(v) / H) * 100}%`,
              width: i === h ? 9 : i === last ? 6 : 4,
              height: i === h ? 9 : i === last ? 6 : 4,
              transform: "translate(-50%, -50%)",
              background: i === h ? "var(--color-white, white)" : A,
              border: i === h ? `2px solid ${A}` : undefined,
            }}
          />
        ),
      )}
      {h != null && (
        <Tip xPct={(x(h) / W) * 100} yPct={(y(values[h]!) / H) * 100}>
          <div className="font-medium tabular-nums">{labels[h] ?? "—"}</div>
          <div className="text-zinc-500">
            {dayLabel(days[h], true)}
            {h === last && days[h] ? " · so far" : ""}
          </div>
        </Tip>
      )}
    </div>
  );
}

export type TrendPoint = { day: string; value: number | null; href?: string; visitors: number; votes: number; signups: number };
export type TrendMetric = { key: string; label: string; fmt: FmtKey; points: TrendPoint[] };

/**
 * Day by day: pick a metric (instant, the URL keeps it), each day a dot, the dashed line is the 7-day average.
 * Hover a day for its date, value, 7-day average and the day's visitors / votes / sign-ups; click a dot for its list.
 */
export function TrendChart({ metrics, initial }: { metrics: TrendMetric[]; initial: string }) {
  const router = useRouter();
  const [key, setKey] = useState(metrics.some((m) => m.key === initial) ? initial : metrics[0].key);
  const [hover, setHover] = useState<number | null>(null);
  const down = useRef<{ touch: boolean; prev: number | null }>({ touch: false, prev: null });
  const m = metrics.find((x) => x.key === key) ?? metrics[0];
  const fmt = (v: number) => fmtBy(m.fmt, v);
  const pick = (k: string) => {
    setKey(k);
    setHover(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("metric", k);
      window.history.replaceState(window.history.state, "", u);
    } catch {}
  };

  const points = m.points;
  const W = 720, H = 240, L = 52, R = 30, T = 16, Bm = 28;
  const nums = points.map((p) => p.value).filter((v): v is number => v != null);
  const lo = Math.min(0, ...nums), hi = Math.max(...nums, 0) || 1;
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
  const last = points.length - 1;
  const h = hover != null && points[hover] ? hover : null;
  const hp = h != null ? points[h] : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Number to chart">
        {metrics.map((x) => (
          <button key={x.key} type="button" role="radio" aria-checked={x.key === m.key} onClick={() => pick(x.key)} className={`chip !py-1 text-xs ${x.key === m.key ? "chip-on" : ""}`}>
            {x.label}
          </button>
        ))}
      </div>
      {nums.length < 2 ? (
        <p className="flex h-[240px] items-center text-sm text-zinc-500">Not enough days yet.</p>
      ) : (
        <div
          className="relative w-full touch-pan-y"
          style={{ aspectRatio: `${W} / ${H}` }}
          onPointerMove={(e) => setHover(nearest(e.currentTarget, e.clientX, points.length, L, R, W))}
          onPointerDown={(e) => {
            down.current = { touch: e.pointerType !== "mouse", prev: hover };
            setHover(nearest(e.currentTarget, e.clientX, points.length, L, R, W));
          }}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
          onClick={(e) => {
            const i = nearest(e.currentTarget, e.clientX, points.length, L, R, W);
            const p = points[i];
            // Mouse: click opens the day's list. Touch: the first tap shows the numbers, a second tap on it opens.
            if (p?.href && (!down.current.touch || down.current.prev === i)) router.push(p.href);
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full cursor-pointer" role="img" aria-label={`${m.label} by day`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-ink/10" />
                <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="text-zinc-500">
                  {fmt(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % every === 0 || i === last ? (
                <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor" className="text-zinc-500">
                  {dayLabel(p.day)}
                </text>
              ) : null,
            )}
            {h != null && <line x1={x(h)} x2={x(h)} y1={T} y2={H - Bm} stroke="currentColor" className="text-ink/25" strokeDasharray="3 3" />}
            <path d={path(avg)} fill="none" stroke={B} strokeWidth="2" strokeDasharray="5 4" />
            <path d={path(points.map((p) => p.value))} fill="none" stroke={A} strokeWidth="2.5" strokeLinejoin="round" />
            {points.map((p, i) => {
              if (p.value == null) return null;
              const on = i === h;
              const hollow = i === last;
              return <circle key={p.day} cx={x(i)} cy={y(p.value)} r={on ? 6 : hollow ? 4 : 3.5} fill={on || hollow ? "var(--color-white, white)" : A} stroke={A} strokeWidth={on ? 3 : 2} />;
            })}
          </svg>
          {hp && h != null && (
            <Tip xPct={(x(h) / W) * 100} yPct={(y(hp.value ?? lo) / H) * 100}>
              <div className="font-medium">
                {dayLabel(hp.day, true)}
                {h === last ? " (so far)" : ""}
              </div>
              <div className="tabular-nums">
                {m.label}: <b>{hp.value == null ? "—" : fmt(hp.value)}</b>
              </div>
              {avg[h] != null && <div className="tabular-nums text-zinc-500">7-day average: {fmt(avg[h]!)}</div>}
              <div className="mt-0.5 tabular-nums text-zinc-500">
                {hp.visitors.toLocaleString()} visitors · {hp.votes.toLocaleString()} votes · {hp.signups.toLocaleString()} sign-ups
              </div>
              {hp.href && <div className="text-zinc-500">{down.current.touch ? "Tap again" : "Click"} for that day&apos;s list</div>}
            </Tip>
          )}
        </div>
      )}
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
