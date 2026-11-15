"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Camera, Link2, Type, Loader2, X } from "lucide-react";
import { api, toast, uploadImage } from "@/lib/client";
import { cn, formatPrice } from "@/lib/utils";

export type OptionDraft = {
  label: string;
  imageUrl?: string;
  url?: string;
  urlTitle?: string;
  urlImage?: string;
  priceCents?: number | null;
  currency?: string | null;
};

export function OptionEditor({ side, value, onChange }: { side: "A" | "B"; value: OptionDraft; onChange: (v: OptionDraft) => void }) {
  const [mode, setMode] = useState<"photo" | "link" | "text">(value.url ? "link" : value.imageUrl ? "photo" : "photo");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(value.url ?? "");
  const isA = side === "A";
  const preview = value.imageUrl || value.urlImage;

  async function onFile(f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadImage(f);
      onChange({ ...value, imageUrl: url });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function fetchLink() {
    if (!link.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ url: string; title: string; image: string | null; priceCents: number | null; currency: string | null }>("/api/unfurl", { body: { url: link.trim() } });
      onChange({
        ...value,
        url: r.url,
        urlTitle: r.title,
        urlImage: r.image ?? undefined,
        priceCents: r.priceCents,
        currency: r.currency,
        label: value.label || r.title.slice(0, 60),
      });
    } catch (e) {
      toast((e as Error).message, "error");
      onChange({ ...value, url: link.trim() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border-2 p-2.5", isA ? "border-a/30 bg-a-soft/50 dark:bg-a/10" : "border-b/30 bg-b-soft/50 dark:bg-b/10")}>
      <div className="flex items-center justify-between">
        <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-extrabold text-white", isA ? "bg-a" : "bg-b")}>{side}</span>
        <div className="flex rounded-full bg-white/80 p-0.5 dark:bg-zinc-900" role="tablist" aria-label={`Option ${side} type`}>
          {(
            [
              ["photo", Camera, "Photo"],
              ["link", Link2, "Link"],
              ["text", Type, "Text"],
            ] as const
          ).map(([m, Icon, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              aria-label={label}
              onClick={() => setMode(m)}
              className={cn("rounded-full p-1.5", mode === m ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-500")}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>

      {mode !== "text" && (
        <div className="relative aspect-square overflow-hidden rounded-xl bg-white/70 dark:bg-zinc-900">
          {preview ? (
            <>
              <img src={preview} alt="" className="size-full object-cover" />
              <button
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white"
                aria-label="Remove image"
                onClick={() => onChange({ ...value, imageUrl: undefined, urlImage: undefined })}
              >
                <X className="size-3.5" />
              </button>
            </>
          ) : mode === "photo" ? (
            <label className="flex size-full cursor-pointer flex-col items-center justify-center gap-1 text-center text-xs font-medium text-zinc-500">
              {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-7" />}
              {busy ? "Uploading…" : "Add photo"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-2">
              <input
                className="input !py-1.5 text-sm"
                placeholder="Paste a link"
                value={link}
                inputMode="url"
                onChange={(e) => setLink(e.target.value)}
                onBlur={fetchLink}
                onKeyDown={(e) => e.key === "Enter" && fetchLink()}
                aria-label={`Link for option ${side}`}
              />
              {busy && <Loader2 className="size-5 animate-spin text-zinc-400" />}
              {value.url && !busy && <span className="line-clamp-2 text-center text-xs text-zinc-500">{value.urlTitle ?? value.url}</span>}
            </div>
          )}
        </div>
      )}

      <input
        className="input !py-2 text-sm font-semibold"
        placeholder={isA ? "e.g. Lego Art Set" : "e.g. Paint easel"}
        maxLength={60}
        value={value.label}
        onChange={(e) => onChange({ ...value, label: e.target.value })}
        aria-label={`Name of option ${side}`}
      />
      {value.priceCents != null && <span className="px-1 text-xs text-zinc-500">{formatPrice(value.priceCents, value.currency)}</span>}
    </div>
  );
}
