"use client";
import { useState } from "react";
import { Check, Mail, MessageCircle, MessageSquare, Share2 } from "lucide-react";
import { toast } from "@/lib/client";
import { TONE_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const display = url.replace(/^https?:\/\//, "");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn’t copy — long-press the link instead", "error");
    }
  }
  return (
    <div className="flex gap-2">
      <input readOnly value={display} className="input min-w-0 flex-1" aria-label="Battle link" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn-accent-outline shrink-0 !px-3.5" onClick={copy}>
        {copied ? (
          <>
            <Check className="size-4" aria-hidden /> Copied
          </>
        ) : (
          "Copy"
        )}
      </button>
    </div>
  );
}

/** 4-up share grid: Messages · WhatsApp · Email · More (native share sheet). */
export function ShareGrid({ url, title }: { url: string; title: string }) {
  const text = `Help me choose: ${title}`;
  const enc = encodeURIComponent;
  async function more() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    toast("Link copied");
  }
  const tile = "flex flex-col items-center gap-1.5 rounded-lg bg-white py-3 text-[13px] text-ink shadow-ring hover:bg-surface";
  const icon = (tone: keyof typeof TONE_CLASSES) => cn("flex size-8 items-center justify-center rounded-lg", TONE_CLASSES[tone].solid);
  return (
    <div className="grid grid-cols-4 gap-2">
      <a className={tile} href={`sms:?&body=${enc(`${text} ${url}`)}`}>
        <span className={icon("green")}>
          <MessageSquare className="size-4" aria-hidden />
        </span>
        Messages
      </a>
      <a className={tile} href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
        <span className={icon("teal")}>
          <MessageCircle className="size-4" aria-hidden />
        </span>
        WhatsApp
      </a>
      <a className={tile} href={`mailto:?subject=${enc(text)}&body=${enc(`${text}\n\n${url}`)}`}>
        <span className={icon("violet")}>
          <Mail className="size-4" aria-hidden />
        </span>
        Email
      </a>
      <button type="button" className={tile} onClick={more}>
        <span className={icon("neutral")}>
          <Share2 className="size-4" aria-hidden />
        </span>
        More
      </button>
    </div>
  );
}

/** Icon-only share (results top bar, visitor view). */
export function ShareIconButton({ url, title, className, children }: { url: string; title: string; className?: string; children?: React.ReactNode }) {
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Help me choose: ${title}`, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    toast("Link copied");
  }
  return (
    <button type="button" className={className ?? "rounded-lg p-2 text-ink hover:bg-surface"} onClick={share} aria-label="Share">
      <Share2 className="size-5" aria-hidden />
      {children}
    </button>
  );
}
