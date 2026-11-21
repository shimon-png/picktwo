"use client";

import { useEffect, useState } from "react";

/**
 * Design preview switcher. Opening any page with ?theme=fizz or ?theme=arcade turns a
 * preview theme on for this browser only (globals.css `html[data-theme=…]`), and shows
 * a small pill to flip between looks. ?theme=off, or "Prompt" + ✕ on the pill, clears it.
 * Everyone else keeps the shipped Prompt look.
 */
import { PREVIEW_THEMES, THEME_PREVIEW_KEY as KEY } from "@/lib/theme-preview";

export function ThemePreview() {
  const [theme, setTheme] = useState<string | null>(null);

  useEffect(() => {
    try {
      setTheme(localStorage.getItem(KEY));
    } catch {}
  }, []);

  if (!theme) return null;

  function pick(id: string | null) {
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {}
    if (id && id !== "prompt") document.documentElement.dataset.theme = id;
    else delete document.documentElement.dataset.theme;
    setTheme(id);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-ink/90 p-1 text-[12px] text-page shadow-lift backdrop-blur">
        <span className="px-2 opacity-70">Preview</span>
        {PREVIEW_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            className={theme === t.id ? "rounded-full bg-page px-2.5 py-1 text-ink" : "rounded-full px-2.5 py-1"}
          >
            {t.name}
          </button>
        ))}
        <button type="button" aria-label="Close design preview" onClick={() => pick(null)} className="rounded-full px-2 py-1 opacity-70">
          ✕
        </button>
      </div>
    </div>
  );
}
