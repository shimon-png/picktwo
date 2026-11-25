"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal snap carousel. Touch swipes natively; mouse users get
 * prev/next arrows, click-and-drag and shift/trackpad wheel scrolling.
 */
export function Carousel({ children, itemClassName, label }: { children: ReactNode; itemClassName?: string; label: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 200), behavior: "smooth" });
  };

  return (
    <div className="group relative">
      <ul
        ref={ref}
        aria-label={label}
        tabIndex={0}
        className={cn(
          "flex gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          dragging ? "cursor-grabbing select-none snap-none" : "snap-x snap-mandatory md:cursor-grab",
        )}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") page(1);
          if (e.key === "ArrowLeft") page(-1);
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
          drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = ref.current;
          if (!d || !el) return;
          const dx = e.clientX - d.x;
          if (!d.moved && Math.abs(dx) > 5) {
            d.moved = true;
            setDragging(true);
            el.setPointerCapture(e.pointerId);
          }
          if (d.moved) el.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          if (drag.current?.moved) setDragging(false);
          // keep `moved` until the click fires so the link doesn't open
          setTimeout(() => (drag.current = null), 0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {Children.map(children, (child) => (
          <li className={cn("shrink-0 snap-start", itemClassName)}>{child}</li>
        ))}
      </ul>
      {canPrev && (
        <button
          type="button"
          aria-label="Previous"
          onClick={() => page(-1)}
          className="absolute left-2 top-[75px] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-card transition hover:scale-105 md:flex"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          aria-label="Next"
          onClick={() => page(1)}
          className="absolute right-2 top-[75px] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-card transition hover:scale-105 md:flex"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
