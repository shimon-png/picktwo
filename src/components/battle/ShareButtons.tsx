"use client";
import { Copy, MessageCircle, Share2, Smartphone } from "lucide-react";
import { toast } from "@/lib/client";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const text = `Help me choose: ${title}`;
  async function native() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {}
    }
    copy();
  }
  async function copy() {
    await navigator.clipboard.writeText(url);
    toast("Link copied — paste it in your group chat");
  }
  const enc = encodeURIComponent;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Get votes fast — share with friends & family</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary !py-1.5" onClick={native}>
          <Share2 className="size-4" /> Share
        </button>
        <a className="btn-outline !py-1.5" href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="size-4" /> WhatsApp
        </a>
        <a className="btn-outline !py-1.5" href={`sms:?&body=${enc(`${text} ${url}`)}`}>
          <Smartphone className="size-4" /> Text
        </a>
        <button className="btn-outline !py-1.5" onClick={copy}>
          <Copy className="size-4" /> Copy link
        </button>
      </div>
    </div>
  );
}
