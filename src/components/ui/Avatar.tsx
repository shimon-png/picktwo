import { AVATAR_TONES, TONE_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

function toneFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({ name, seed, size = 20, className }: { name: string; seed?: string; size?: number; className?: string }) {
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
