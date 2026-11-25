"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ImagePlus, Loader2, X } from "lucide-react";
import { api, toast, uploadImage } from "@/lib/client";

const EXAMPLES = ["Which dress for a winter wedding?", "Should I text him back?", "Rent this one or keep looking?", "Gift for my mom under $50"];

/**
 * The Pickbot text box: words, up to 4 photos. New question (no `threadId`) → opens the thread; follow-up → `onSent`.
 */
export function AskComposer({ threadId, onSent, examples = false, placeholder = "Ask anything…" }: { threadId?: string; onSent?: () => void; examples?: boolean; placeholder?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    const list = [...(files ?? [])].slice(0, 4 - photos.length);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const url = await uploadImage(f);
        setPhotos((p) => [...p, url].slice(0, 4));
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function send() {
    const t = text.trim();
    if (t.length < 3 || busy || uploading) return;
    setBusy(true);
    try {
      if (threadId) {
        await api(`/api/pickbot/${threadId}/followup`, { body: { text: t, photos } });
        setText("");
        setPhotos([]);
        onSent?.();
      } else {
        const { id } = await api<{ id: string }>("/api/pickbot/ask", { body: { text: t, photos } });
        router.push(`/ask/${id}`);
        return;
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {examples && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}
      <div className="card-ring rounded-[18px] bg-white p-2 shadow-soft">
        {(photos.length > 0 || uploading > 0) && (
          <div className="flex gap-2 p-1">
            {photos.map((p, i) => (
              <div key={p} className="relative size-16 overflow-hidden rounded-[10px]">
                <img src={p} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                <button type="button" aria-label={`Remove photo ${i + 1}`} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" onClick={() => setPhotos(photos.filter((x) => x !== p))}>
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <div key={`u${i}`} className="flex size-16 items-center justify-center rounded-[10px] bg-surface">
                <Loader2 className="size-5 animate-spin text-ink/50" />
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <textarea
            aria-label={threadId ? "Ask a follow-up" : "Ask Pickbot"}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={threadId ? 1 : 2}
            placeholder={placeholder}
            className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink/40"
          />
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
          <button type="button" aria-label="Add photos" disabled={photos.length >= 4} className="flex size-11 items-center justify-center rounded-full text-ink/60 disabled:opacity-30" onClick={() => file.current?.click()}>
            <ImagePlus className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Send"
            disabled={text.trim().length < 3 || busy || uploading > 0}
            onClick={send}
            className="btn-primary flex size-11 items-center justify-center !rounded-full !p-0 transition disabled:opacity-30"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
