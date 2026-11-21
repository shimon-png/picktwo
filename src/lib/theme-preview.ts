/** Design preview themes (see components/layout/ThemePreview.tsx and globals.css). */
export const PREVIEW_THEMES = [
  { id: "prompt", name: "Prompt" },
  { id: "fizz", name: "Pop Fizz" },
  { id: "arcade", name: "Arcade Night" },
] as const;

export const THEME_PREVIEW_KEY = "cp_theme_preview";
const KEY = THEME_PREVIEW_KEY;

/** Runs before paint (inline in <head>) so there is no flash of the wrong theme. */
export const themeBootScript = `(function(){try{var q=new URLSearchParams(location.search).get("theme");var k="${KEY}";
if(q==="off"){localStorage.removeItem(k)}else if(q){localStorage.setItem(k,q)}
var t=localStorage.getItem(k);if(t&&t!=="prompt")document.documentElement.dataset.theme=t;}catch(e){}})();`;

