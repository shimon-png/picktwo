"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { api, cropSquare, toast } from "@/lib/client";

/** Profile photo picker on Settings: tap the circle to upload, crop is a centred square. */
export function AvatarEditor({ image, name }: { image: string | null; name: string }) {
  const [url, setUrl] = useState(image);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const initial = (name.replace(/^@/, "")[0] ?? "?").toUpperCase();

  async function onFile(f?: File) {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) return toast("That image is over 15 MB — please pick a smaller one", "error");
    setBusy(true);
    try {
      const blob = await cropSquare(f);
      const form = new FormData();
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const r = await api<{ url: string }>("/api/me/avatar", { form });
      setUrl(r.url);
      toast("Photo updated", "ok");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/me/avatar", { method: "DELETE" });
      setUrl(null);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="relative size-20 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-a to-b text-3xl text-white disabled:opacity-60"
        aria-label="Change profile photo"
      >
        {url ? <img src={url} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center">{initial}</span>}
        <span className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border-2 border-white bg-ink text-white">
          <Camera className="size-3.5" aria-hidden />
        </span>
      </button>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline px-3 py-1.5 text-sm" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? "Uploading…" : url ? "Change photo" : "Upload photo"}
          </button>
          {url && (
            <button type="button" className="px-2 text-sm text-zinc-500 underline-offset-2 hover:underline" onClick={remove} disabled={busy}>
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">A photo of you. Please don’t use photos of kids.</p>
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
