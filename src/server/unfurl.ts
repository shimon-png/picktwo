import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "./errors";

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase();
    return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l === "::" || l.startsWith("::ffff:127.");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AppError("VALIDATION", "That doesn't look like a link");
  }
  if (!/^https?:$/.test(u.protocol)) throw new AppError("VALIDATION", "Only http(s) links are supported");
  const addrs = await lookup(u.hostname, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new AppError("VALIDATION", "That link can't be previewed");
  return u;
}

function meta(html: string, keys: string[]): string | undefined {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content.trim());
  }
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function unfurl(raw: string) {
  let url = await assertPublicUrl(raw);
  let html = "";
  // Follow up to 3 redirects manually so each hop is SSRF-checked.
  for (let hop = 0; hop < 4; hop++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; crowdpickBot/1.0; +https://crowdpick.ai)", Accept: "text/html" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
        continue;
      }
      const reader = res.body?.getReader();
      if (!reader) break;
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (size < 2_000_000) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
        if (new TextDecoder().decode(value).includes("</head>")) break;
      }
      reader.cancel().catch(() => {});
      html = new TextDecoder().decode(Buffer.concat(chunks));
      break;
    } catch {
      break;
    } finally {
      clearTimeout(t);
    }
  }
  const title = meta(html, ["og:title", "twitter:title"]) || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "") || url.hostname;
  let image = meta(html, ["og:image", "og:image:url", "twitter:image", "image"]);
  if (image) {
    try {
      image = new URL(image, url).toString();
    } catch {
      image = undefined;
    }
  }
  const priceStr = meta(html, ["product:price:amount", "og:price:amount", "price"]);
  const currency = meta(html, ["product:price:currency", "og:price:currency", "priceCurrency"]) || null;
  const price = priceStr ? Math.round(parseFloat(priceStr.replace(/[^0-9.]/g, "")) * 100) : null;
  return {
    url: url.toString(),
    title: title.slice(0, 120),
    image: image ?? null,
    priceCents: price && Number.isFinite(price) ? price : null,
    currency,
  };
}
