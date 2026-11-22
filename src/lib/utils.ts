import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pct(a: number, b: number) {
  const total = a + b;
  if (total === 0) return { a: 0, b: 0, total };
  const pa = Math.round((a / total) * 100);
  return { a: pa, b: 100 - pa, total };
}

export function timeLeft(deadline: Date | string, now = new Date()): string {
  const ms = new Date(deadline).getTime() - now.getTime();
  if (ms <= 0) return "Closed";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

export function timeAgo(date: Date | string, now = new Date()): string {
  const s = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
}

/** Font size for a battle question: long, story-style titles step down so the photos keep their room. */
export function titleSizeClass(title: string, base = "text-[28px] leading-[1.05]") {
  const n = title.length;
  if (n > 110) return "text-[19px] leading-[1.15]";
  if (n > 70) return "text-[22px] leading-[1.1]";
  return base;
}

export function formatPrice(cents?: number | null, currency?: string | null) {
  if (cents == null) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function appUrl(path = "") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return base.replace(/\/$/, "") + path;
}
