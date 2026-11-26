import "@fontsource/jetbrains-mono/700.css";
import { cn } from "@/lib/utils";

/**
 * Pickbot's own look (Alex picked "Robo head", Nov 26 2026): a lavender robot head with a dark visor, crowdpick's
 * A (blue) and B (red) eyes, a lime antenna, and a mono "PICKBOT" wordmark. Fixed colours so every theme matches.
 * Options sheet: /mnt/project-files/design/pickbot-logos/.
 */
export function PickbotMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 88 88" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <circle cx="44" cy="7" r="7" fill="#c6ff3d" />
      <rect x="41" y="10" width="6" height="10" rx="3" fill="#c6ff3d" />
      <rect x="8" y="18" width="72" height="62" rx="20" fill="#e9e3ff" />
      <rect x="16" y="30" width="56" height="30" rx="15" fill="#1e1840" />
      <circle cx="32" cy="45" r="8.5" fill="#2bd2ff" />
      <circle cx="56" cy="45" r="8.5" fill="#ff3cac" />
      <rect x="34" y="66" width="20" height="5" rx="2.5" fill="#8b5cf6" />
    </svg>
  );
}

/** The "PICKBOT" wordmark, sized by the surrounding text. */
export function PickbotWord({ className }: { className?: string }) {
  return <b className={cn("pickbot-word font-bold uppercase tracking-[.06em] text-violet", className)} style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>Pickbot</b>;
}
