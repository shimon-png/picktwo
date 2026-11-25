/**
 * "Add to home screen" (PRD phase 4): when to suggest it, per platform. Pure, used in the browser; tested in
 * tests/unit/install.test.ts.
 */
export type InstallPlatform = "ios" | "android" | "desktop";

/**
 * Suggest "add to home screen"? Only on phones, not already installed, after a few visits (so it doesn't greet a
 * first-timer), and not again for `snoozeDays` after a "Not now".
 */
export function shouldSuggestInstall(a: { platform: InstallPlatform; standalone: boolean; visits: number; dismissedAt: number | null; now: number; minVisits?: number; snoozeDays?: number; canPrompt: boolean }): boolean {
  if (a.standalone || a.platform === "desktop") return false;
  if (a.platform === "android" && !a.canPrompt) return false;
  if (a.visits < (a.minVisits ?? 2)) return false;
  if (a.dismissedAt && a.now - a.dismissedAt < (a.snoozeDays ?? 14) * 86400_000) return false;
  return true;
}

export function platformFrom(ua: string): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}
