"use client";

import { useEffect, useState } from "react";

/**
 * Theme switcher. Everyone gets DEFAULT_THEME (rendered on <html>). Opening any page with
 * ?theme=prompt|fizz|arcade saves a choice for this browser only and shows this pill to flip
 * between looks; ✕ or ?theme=off drops the choice and hides the pill.
 */
import { DEFAULT_THEME, PREVIEW_THEMES, THEME_PREVIEW_KEY as KEY, applyTheme } from "@/lib/theme-preview";

export function ThemePreview() {
  const [theme, setTheme] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      setTheme(t);
      applyTheme(t); // keep the attribute if React re-rendered <html>
    } catch {}
  }, []);

  if (!theme) return null;

  function pick(id: string | null) {
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {}
    applyTheme(id);
    setTheme(id);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.85rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-ink/90 p-1 text-[12px] text-page shadow-lift backdrop-blur">
        <span className="px-2 opacity-70">Look</span>
        {PREVIEW_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            className={(theme ?? DEFAULT_THEME) === t.id ? "rounded-full bg-page px-2.5 py-1 text-ink" : "rounded-full px-2.5 py-1"}
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
