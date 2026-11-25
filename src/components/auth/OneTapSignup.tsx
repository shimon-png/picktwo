"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { Pencil } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { AGE_RANGES } from "@/lib/constants";
import { suggestedHandle } from "@/lib/handles";
import { useZipCheck } from "@/lib/use-zip";
import { ZipHint } from "@/components/ui/ZipHint";

type Prefill = {
  votes: number;
  handle: string;
  sex: string | null;
  ageRange: string | null;
  zipCode: string | null;
  zipFromIp: boolean;
  place: string | null;
  google: boolean;
};

/** Saved before Google's redirect; /signup/finish posts it once the account exists. */
export const PREFILL_KEY = "cp:signup_prefill";

const CODE_ERRORS: Record<string, string> = {
  invalid: "That code isn’t right. Check the email and try again.",
  expired: "That code has expired. Tap “Send a new code”.",
  too_many: "Too many tries. Tap “Send a new code”.",
  blocked: "This account is not available.",
  server: "Something went wrong on our side, not your code. Try again in a minute.",
};
const SEX_LABEL: Record<string, string> = { FEMALE: "Woman", MALE: "Man" };
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/**
 * The sign-up card at the end of the free votes (About-you plan §3b, Nov 25 2026): everything we already know is
 * filled in (username, sex · age from the about-you cards, ZIP from the card or the IP guess), each row editable,
 * so the only action left is who they are: Google (when set up) or email + code. Sex, age and ZIP are optional.
 * Ends with a full page load of `next` so the guest's votes and answers move onto the new account.
 */
export function OneTapSignup({ next, soft = false }: { next: string; soft?: boolean }) {
  const [pre, setPre] = useState<Prefill | null>(null);
  const [step, setStep] = useState<"confirm" | "code">("confirm");
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [sex, setSex] = useState("");
  const [age, setAge] = useState("");
  const [zip, setZip] = useState("");
  const [edit, setEdit] = useState<"handle" | "about" | "place" | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zipCheck = useZipCheck(zip);
  // Stable digits for the email-based username suggestion while they type.
  const digits = useMemo(() => Math.random(), []);

  useEffect(() => {
    api<Prefill>("/api/signup-prefill")
      .then((p) => {
        setPre(p);
        setHandle(p.handle);
        setSex(p.sex ?? "");
        setAge(p.ageRange ?? "");
        setZip(p.zipCode ?? "");
      })
      .catch(() => setPre({ votes: 0, handle: "", sex: null, ageRange: null, zipCode: null, zipFromIp: false, place: null, google: false }));
  }, []);

  // Before they edit it, the username follows the email ("mia@…" → mia4859), like the rest of sign-up.
  useEffect(() => {
    if (!handleEdited && email.includes("@")) setHandle(suggestedHandle(email, () => digits));
  }, [email, handleEdited, digits]);

  const profile = () => ({
    ...(handleEdited && HANDLE_RE.test(handle) ? { handle } : {}),
    ...(sex ? { sex } : {}),
    ...(age ? { ageRange: age } : {}),
    ...(zip.trim() && zipCheck.state === "ok" ? { zipCode: zip.trim() } : {}),
  });

  async function finish() {
    try {
      const s = await api<{ complete: boolean }>("/api/me/quick-profile");
      // A returning account keeps its own profile; a new one gets what's on the card.
      if (!s.complete) await api("/api/me/quick-profile", { body: { ...profile(), handle: HANDLE_RE.test(handle) ? handle : undefined } });
      window.location.assign(next);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      if (err.code === "CONFLICT") {
        setStep("confirm");
        setEdit("handle");
      }
      setBusy(false);
    }
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ devCode?: string }>("/api/signin-code", { body: { email } });
      setDevCode(r.devCode ?? null);
      setCode("");
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await signIn("code", { email, code: code.trim(), redirect: false }).catch(() => null);
    if (!r || r.error) {
      setError(r?.error === "CredentialsSignin" ? (CODE_ERRORS[r.code ?? ""] ?? CODE_ERRORS.invalid) : `${CODE_ERRORS.server} (${r?.error ?? "no response"})`);
      setBusy(false);
      return;
    }
    await finish();
  }

  function google() {
    try {
      localStorage.setItem(PREFILL_KEY, JSON.stringify(profile()));
    } catch {}
    signIn("google", { callbackUrl: `/signup/finish?next=${encodeURIComponent(next)}` });
  }

  if (!pre) return <div className="h-64 animate-pulse rounded-[14px] bg-surface" aria-label="Loading" />;

  const aboutLine = [SEX_LABEL[sex], AGE_RANGES.find((a) => a.id === age)?.label].filter(Boolean).join(" · ");
  const placeLine = zip.trim() && zipCheck.state === "ok" ? `${zipCheck.state === "ok" && zip === pre.zipCode && pre.place ? `${pre.place} ` : ""}${zip.trim()}` : "";

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="inline-block rounded-full bg-green-soft px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-[.1em] text-green">
          Save your {pre.votes > 0 ? `${pre.votes} ` : ""}picks
        </span>
        <h2 className="text-[22px] leading-tight">You’re all set. Just confirm.</h2>
        <p className="text-sm text-zinc-600">
          {soft ? "Saves your picks and streak, or keep voting for now." : "Keep voting, save your picks and see how people like you voted."}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {step === "confirm" && (
        <>
          <ul className="space-y-1.5">
            <Row label={`@${handle || "username"}`} hint="Username" onEdit={() => setEdit(edit === "handle" ? null : "handle")} open={edit === "handle"}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">@</span>
                <input
                  aria-label="Username"
                  autoCapitalize="none"
                  className="input !pl-7"
                  maxLength={20}
                  value={handle}
                  onChange={(e) => {
                    setHandleEdited(true);
                    setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                  }}
                />
              </div>
            </Row>
            <Row label={aboutLine || "Add sex and age (optional)"} hint="About you" muted={!aboutLine} onEdit={() => setEdit(edit === "about" ? null : "about")} open={edit === "about"}>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(SEX_LABEL).map(([id, l]) => (
                  <button key={id} type="button" className={cn("chip !py-1 text-sm", sex === id && "chip-on")} aria-pressed={sex === id} onClick={() => setSex(sex === id ? "" : id)}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {AGE_RANGES.map((a) => (
                  <button key={a.id} type="button" className={cn("chip !py-1 text-sm", age === a.id && "chip-on")} aria-pressed={age === a.id} onClick={() => setAge(age === a.id ? "" : a.id)}>
                    {a.label}
                  </button>
                ))}
              </div>
            </Row>
            <Row label={placeLine || "Add your ZIP (optional)"} hint={pre.zipFromIp && zip === pre.zipCode ? "Your area (from your connection)" : "Your area"} muted={!placeLine} onEdit={() => setEdit(edit === "place" ? null : "place")} open={edit === "place"}>
              <input aria-label="ZIP code" className="input" inputMode="numeric" autoComplete="postal-code" maxLength={10} placeholder="ZIP code" value={zip} onChange={(e) => setZip(e.target.value)} />
              <ZipHint check={zipCheck} />
            </Row>
          </ul>

          {pre.google && (
            <button type="button" className="btn-cta w-full py-3" onClick={google} disabled={busy}>
              Continue with Google
            </button>
          )}
          <form onSubmit={sendCode} className="space-y-2">
            <label htmlFor="onetap-email" className={cn("label", pre.google && "text-zinc-500")}>
              {pre.google ? "Or use email + code" : "Your email"}
            </label>
            <input
              id="onetap-email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Your email"
            />
            <button className={cn("w-full py-3", pre.google ? "btn-outline" : "btn-cta")} disabled={busy || !email.trim() || !HANDLE_RE.test(handle) || (!!zip.trim() && zipCheck.state === "bad")}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </form>
          <p className="text-center text-xs text-zinc-400">
            By continuing you confirm you’re 18 or older and agree to our{" "}
            <Link href="/legal/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-zinc-600">
            We sent a 6-digit code to <span className="text-ink">{email}</span>. It expires in 10 minutes.
          </p>
          {devCode && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Dev mode: your code is {devCode}</p>}
          <div>
            <label htmlFor="onetap-code" className="label">
              Code
            </label>
            <input
              id="onetap-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              required
              className="input text-center text-2xl tracking-[0.4em]"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <button className="btn-cta w-full py-3" disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Verify"}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-accent" disabled={busy} onClick={() => sendCode()}>
              Send a new code
            </button>
            <button type="button" className="text-zinc-500" onClick={() => setStep("confirm")}>
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label, hint, muted, open, onEdit, children }: { label: string; hint: string; muted?: boolean; open: boolean; onEdit: () => void; children: React.ReactNode }) {
  return (
    <li className="rounded-[12px] bg-surface px-3 py-2">
      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={onEdit} aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-zinc-500">{hint}</span>
          <span className={cn("block truncate text-[14px]", muted && "text-zinc-500")}>{label}</span>
        </span>
        <Pencil className="size-3.5 shrink-0 text-zinc-500" aria-hidden />
        <span className="sr-only">Edit</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </li>
  );
}
