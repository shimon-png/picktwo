"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, toast } from "@/lib/client";

/** Starts Stripe Checkout (or opens the billing portal with `manage`). */
export function PlusButton({ manage = false, children }: { manage?: boolean; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={manage ? "btn-outline" : "btn-primary w-full"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = await api<{ url: string }>(manage ? "/api/plus/portal" : "/api/plus/checkout", { body: {} });
          window.location.href = url;
        } catch (e) {
          toast((e as Error).message, "error");
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : children}
    </button>
  );
}
