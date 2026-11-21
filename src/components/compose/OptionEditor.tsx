"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { Camera, Link2, Loader2, Type, X } from "lucide-react";
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

/**
 * One option slot on the New battle screen. Empty: dashed box with Photo · Link · Name.
 * Filled: preview with × to clear. The name input sits under the slot.
 */
export function OptionEditor({ side, value, onChange }: { side: "A" | "B"; value: OptionDraft; onChange: (v: OptionDraft) => void }) {
  const [mode, setMode] = useState<"pick" | "link" | "text">(value.url ? "link" : value.label && !value.imageUrl ? "text" : "pick");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(value.url ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const isA = side === "A";
  const preview = value.imageUrl || value.urlImage;
  const filled = !!preview || !!value.url || mode === "text";

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
    if (!link.trim() || link.trim() === value.url) return;
    setBusy(true);
    try {
      const r = await api<{ url: string; title: string; image: string | null; priceCents: number | null; currency: string | null }>("/api/unfurl", {
        body: { url: link.trim() },
      });
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

  function clear() {
    onChange({ label: value.label });
    setLink("");
    setMode("pick");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div
        className={cn(
          "relative min-h-[120px] flex-1 overflow-hidden rounded-xl",
          filled ? (isA ? "bg-gradient-to-b from-a-soft to-white shadow-ring" : "bg-gradient-to-b from-b-soft to-white shadow-ring") : "border-[1.5px] border-dashed border-ink/20",
        )}
      >
        <span
          className={cn("absolute left-2.5 top-2.5 z-10 flex size-5 items-center justify-center rounded-full border bg-white/80 text-[11px]", isA ? "border-a text-a" : "border-b text-b")}
          aria-hidden
        >
          {side}
        </span>

        {preview && <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />}

        {!preview && mode === "pick" && (
          <div className="flex size-full items-center justify-center gap-2 p-3">
            {busy ? (
              <Loader2 className="size-6 animate-spin text-zinc-400" aria-label="Uploading" />
            ) : (
              (
                [
                  ["Photo", Camera, () => fileRef.current?.click()],
                  ["Link", Link2, () => setMode("link")],
                  [
                    "Name",
                    Type,
                    () => {
                      setMode("text");
                      setTimeout(() => nameRef.current?.focus(), 0);
                    },
                  ],
                ] as const
              ).map(([label, Icon, on]) => (
                <button
                  key={label}
                  type="button"
                  onClick={on}
                  aria-label={`${label} for option ${side}`}
                  className="flex w-[76px] flex-col items-center gap-1 rounded-lg bg-white py-2.5 text-[13px] text-ink shadow-ring hover:bg-surface"
                >
                  <Icon className="size-4 text-zinc-500" aria-hidden />
                  {label}
                </button>
              ))
            )}
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        )}

        {!preview && mode === "link" && (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-4">
            <input
              autoFocus
              className="input !bg-white"
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

        {!preview && mode === "text" && (
          <div className="flex size-full items-center justify-center p-6 text-center text-lg text-ink">
            {value.label || <span className="text-zinc-400">Type a name below</span>}
          </div>
        )}

        {filled && (
          <button type="button" onClick={clear} className="absolute right-2 top-2 z-10 rounded-full bg-black/55 p-1 text-white" aria-label={`Clear option ${side}`}>
            <X className="size-3.5" />
          </button>
        )}
        {value.priceCents != null && (
          <span className="absolute bottom-2 left-2.5 z-10 rounded bg-white/90 px-1.5 text-xs">{formatPrice(value.priceCents, value.currency)}</span>
        )}
      </div>
      <input
        ref={nameRef}
        className="input"
        placeholder={isA ? "e.g. Lego Art Set" : "e.g. Paint easel"}
        maxLength={60}
        value={value.label}
        onChange={(e) => onChange({ ...value, label: e.target.value })}
        aria-label={`Name of option ${side}`}
      />
    </div>
  );
}
