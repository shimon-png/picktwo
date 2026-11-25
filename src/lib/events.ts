"use client";
/**
 * Client event log for the data brain (docs/brain/). Events are queued and sent in batches to
 * POST /api/events, which stamps who / which device / server time and appends them to `analytics_event`.
 * Never throws: analytics must never break the app.
 *
 * Event names and their props are listed in docs/brain/data-dictionary.md; add new ones there and to
 * CLIENT_EVENTS in lib/validators.ts.
 */
import { createId } from "@/lib/id";
import type { ClientEventName } from "@/lib/validators";

const SESSION_KEY = "cp:sess";
const FIRST_TOUCH_KEY = "cp:first";
/** A session ends after 30 minutes with no events. */
const IDLE_MS = 30 * 60 * 1000;
const FLUSH_MS = 4000;
const MAX_BATCH = 25;

type Queued = { id: string; name: ClientEventName; at: number; sessionId: string; seq: number; props: Record<string, unknown> };
type Session = { id: string; last: number; seq: number };

const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let mem: Session | null = null;

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : mem;
  } catch {
    return mem;
  }
}

function writeSession(s: Session) {
  mem = s;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {}
}

let booted = false;

/**
 * The current session; a new one starts after IDLE_MS of quiet, or on the first event of a page load that
 * came from an ad / campaign link (so each click is credited). A new session's first event is always
 * `session_start`, carrying the acquisition facts.
 */
function ensureSession(): Session {
  const now = Date.now();
  let s = readSession();
  let fresh = !s || now - s.last >= IDLE_MS;
  let a: Record<string, string> | null = null;
  if (!booted) {
    booted = true;
    a = attribution();
    if (hasCampaign(a)) fresh = true;
  }
  if (!s || fresh) {
    s = { id: createId(), last: now, seq: 1 };
    writeSession(s);
    queue.push({ id: createId(), name: "session_start", at: now, sessionId: s.id, seq: 1, props: startProps(a ?? attribution()) });
    deviceHints();
  }
  return s;
}

function startProps(a: Record<string, string>): Record<string, unknown> {
  let standalone = false;
  try {
    standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {}
  return {
    ...a,
    first: firstTouch(a),
    standalone,
    vw: window.innerWidth,
    vh: window.innerHeight,
    // Screen + density place an iPhone in a class (passive-rules deviceTier); deviceMemory is Chrome-only.
    sw: window.screen?.width,
    sh: window.screen?.height,
    dpr: window.devicePixelRatio,
    mem: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
    tz: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return null;
      }
    })(),
    lang: navigator.language,
  };
}

/** Android Chrome can name the phone model (client hints); once per session, as its own `device_hints` event. */
function deviceHints() {
  try {
    const uad = (navigator as unknown as { userAgentData?: { mobile?: boolean; getHighEntropyValues?: (h: string[]) => Promise<Record<string, string>> } }).userAgentData;
    if (!uad?.mobile || !uad.getHighEntropyValues) return;
    uad
      .getHighEntropyValues(["model", "platformVersion"])
      .then((h) => {
        if (h.model) logEvent("device_hints", { model: String(h.model).slice(0, 40), platformVersion: String(h.platformVersion ?? "").slice(0, 20), mem: (navigator as unknown as { deviceMemory?: number }).deviceMemory });
      })
      .catch(() => {});
  } catch {}
}

function nextSeq(): { sessionId: string; seq: number } {
  const s = ensureSession();
  const seq = (s.seq ?? 0) + 1;
  writeSession({ ...s, seq, last: Date.now() });
  return { sessionId: s.id, seq };
}

export function currentSessionId(): string | null {
  try {
    return readSession()?.id ?? null;
  } catch {
    return null;
  }
}

function send(batch: Queued[], beacon: boolean) {
  if (!batch.length) return;
  const body = JSON.stringify({ events: batch });
  try {
    if (beacon && navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch {}
}

export function flushEvents(beacon = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  while (queue.length) send(queue.splice(0, MAX_BATCH), beacon);
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const out = () => flushEvents(true);
  window.addEventListener("pagehide", out);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") out();
  });
}

/** Queue one event. Props should be small, flat facts (ids, counts, short strings), never free text. */
export function logEvent(name: ClientEventName, props: Record<string, unknown> = {}) {
  try {
    if (typeof window === "undefined") return;
    listen();
    const { sessionId, seq } = nextSeq();
    queue.push({ id: createId(), name, at: Date.now(), sessionId, seq, props });
    if (queue.length >= MAX_BATCH) flushEvents();
    else if (!timer) timer = setTimeout(() => flushEvents(), FLUSH_MS);
  } catch {}
}

// ---------- Acquisition ----------
const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"] as const;
const CLICK_KEYS = ["fbclid", "gclid", "ttclid", "msclkid", "twclid", "li_fat_id", "rdt_cid", "sccid"] as const;

/** Campaign tags, ad click ids, referrer and landing page of this page load. */
export function attribution(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const u = new URL(window.location.href);
    for (const k of [...CAMPAIGN_KEYS, ...CLICK_KEYS]) {
      const v = u.searchParams.get(k);
      if (v) out[k] = v.slice(0, 200);
    }
    out.landing = u.pathname;
    const ref = document.referrer;
    if (ref) {
      const r = new URL(ref);
      if (r.origin !== u.origin) {
        out.referrer = (r.host + r.pathname).slice(0, 200);
        out.referrerHost = r.host;
      }
    }
  } catch {}
  return out;
}

/** True when this URL carries ad / campaign tags (a new ad click starts a new session). */
export function hasCampaign(a: Record<string, string>): boolean {
  return [...CAMPAIGN_KEYS, ...CLICK_KEYS].some((k) => a[k]);
}

/** The very first visit's attribution on this browser, saved once and never overwritten. */
export function firstTouch(current: Record<string, string>): Record<string, string> & { at?: string } {
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
    if (raw) return JSON.parse(raw);
    const first = { ...current, at: new Date().toISOString() };
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(first));
    return { ...first, isFirstVisit: "1" };
  } catch {
    return {};
  }
}

// ---------- Content facts ----------
/** Short, stable fingerprint of what a card showed, so later analysis can tell wording versions apart. */
export function contentHash(parts: (string | null | undefined)[]): string {
  let h = 5381;
  const s = parts.map((p) => p ?? "").join("\u0001");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function cardKind(imageA: string | null, imageB: string | null): "text" | "photo" | "mixed" {
  if (imageA && imageB) return "photo";
  if (!imageA && !imageB) return "text";
  return "mixed";
}
