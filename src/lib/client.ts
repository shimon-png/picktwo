"use client";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error?.code ?? "ERROR", data?.error?.message ?? "Something went wrong", res.status);
  return data as T;
}

// --- tiny event bus for toasts + priority balance updates ---
export type Toast = { id: number; text: string; tone?: "default" | "pp" | "error" | "ok" };

export function toast(text: string, tone: Toast["tone"] = "default") {
  window.dispatchEvent(new CustomEvent("pt:toast", { detail: { id: Date.now() + Math.random(), text, tone } }));
}

export function setPP(balance: number | null | undefined) {
  if (typeof balance === "number") window.dispatchEvent(new CustomEvent("pt:pp", { detail: balance }));
}

/** Resize an image client-side to max 1600px JPEG (PRD B-2). */
export async function resizeImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
}

export async function uploadImage(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("That image is over 10 MB — please pick a smaller one");
  const blob = await resizeImage(file);
  const form = new FormData();
  form.append("file", new File([blob], "image.jpg", { type: blob.type || "image/jpeg" }));
  const { url } = await api<{ url: string }>("/api/upload", { form });
  return url;
}
