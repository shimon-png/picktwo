/* eslint-disable @next/next/no-img-element */
import { AVATAR_TONES, TONE_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

function toneFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** Round avatar: the user's photo when they set one, otherwise their initial on a tone colour. */
export function Avatar({ name, seed, src, size = 20, className }: { name: string; seed?: string; src?: string | null; size?: number; className?: string }) {
  if (src)
    return (
      <img src={src} alt="" width={size} height={size} loading="lazy" className={cn("shrink-0 rounded-full bg-surface object-cover", className)} style={{ width: size, height: size }} />
    );
  const initial = (name.replace(/^@/, "")[0] ?? "?").toUpperCase();
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium", TONE_CLASSES[toneFor(seed ?? name)].solid, className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
