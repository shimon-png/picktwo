/** Site themes (see components/layout/ThemePreview.tsx and the end of globals.css). */
export const PREVIEW_THEMES = [
  { id: "arcade", name: "Arcade Night" },
  { id: "prompt", name: "Prompt" },
  { id: "fizz", name: "Pop Fizz" },
] as const;

export type ThemeId = (typeof PREVIEW_THEMES)[number]["id"];

/** What everyone sees. "prompt" is the base CSS with no data-theme attribute. */
export const DEFAULT_THEME: ThemeId = "arcade";

export const THEME_PREVIEW_KEY = "cp_theme_preview";

const IDS = PREVIEW_THEMES.map((t) => t.id);

/** Sets <html data-theme> for a theme id ("prompt" = no attribute). */
export function applyTheme(id: string | null) {
  const t = id && (IDS as string[]).includes(id) ? id : DEFAULT_THEME;
  if (t === "prompt") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

/** Runs before paint (inline in <head>) so a per-browser choice shows without a flash. */
export const themeBootScript = `(function(){try{var q=new URLSearchParams(location.search).get("theme");var k="${THEME_PREVIEW_KEY}";
var ids=${JSON.stringify(IDS)};
if(q==="off"){localStorage.removeItem(k)}else if(q&&ids.indexOf(q)>=0){localStorage.setItem(k,q)}
var t=localStorage.getItem(k);if(!t||ids.indexOf(t)<0)t="${DEFAULT_THEME}";
if(t==="prompt"){delete document.documentElement.dataset.theme}else{document.documentElement.dataset.theme=t}}catch(e){}})();`;
