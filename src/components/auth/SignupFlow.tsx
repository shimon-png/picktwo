"use client";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { AGE_RANGES, SEX_OPTIONS } from "@/lib/constants";
import { ChipGroup } from "@/components/compose/ComposeForm";

type Step = "email" | "code" | "username" | "about";
const STEPS: Step[] = ["email", "code", "username", "about"];
type Status = { complete: boolean; handle: string; sex: string | null; ageRange: string | null; zipCode: string | null };
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

const CODE_ERRORS: Record<string, string> = {
  invalid: "That code isn’t right. Check the email and try again.",
  expired: "That code has expired. Tap “Send a new code”.",
  too_many: "Too many tries. Tap “Send a new code”.",
  blocked: "This account is not available.",
  server: "Something went wrong on our side, not your code. Try again in a minute.",
};

/**
 * Sign up / sign in in 4 steps: email → 6-digit code → username → sex + age. ZIP is never asked (Alex, Nov 26
 * 2026): the about-you answer or the IP guess from GET /api/me/quick-profile is saved silently.
 * Existing users with a complete profile finish after the code. Ends with a full page load of `next`
 * so the server links this device (and its guest votes) to the account.
 */
export function SignupFlow({ next, intro, finishLabel = "Finish" }: { next: string; intro?: React.ReactNode; finishLabel?: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [sex, setSex] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => window.location.assign(next);

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
    try {
      const r = await signIn("code", { email, code: code.trim(), redirect: false });
      if (!r || r.error) {
        // CredentialsSignin carries our code; anything else (Configuration, MissingCSRF…) is a server-side problem.
        setError(
          r?.error === "CredentialsSignin"
            ? (CODE_ERRORS[r.code ?? ""] ?? CODE_ERRORS.invalid)
            : `${CODE_ERRORS.server} (${r?.error ?? "no response"})`,
        );
        return;
      }
      const s = await api<Status>("/api/me/quick-profile");
      if (s.complete) return done();
      setHandle(s.handle ?? "");
      setSex(s.sex ?? "");
      setAgeRange(s.ageRange ?? "");
      setZip(s.zipCode ?? "");
      setStep("username");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Sex and age are optional since the one-tap sign-up (the Vote deck asks later); ZIP is inferred, never asked.
      await api("/api/me/quick-profile", { body: { handle, sex: sex || undefined, ageRange: ageRange || undefined, zipCode: zip.trim() || undefined } });
      done();
    } catch (err) {
      const e = err as Error & { code?: string };
      setError(e.message);
      if (e.code === "CONFLICT") setStep("username");
      setBusy(false);
    }
  }

  const n = STEPS.indexOf(step) + 1;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Step {n} of 4</span>
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s} className={cn("h-1.5 w-6 rounded-full", i < n ? "bg-accent" : "bg-zinc-200")} />
            ))}
          </div>
        </div>
        {step === "email" && intro}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {step === "email" && (
        <form onSubmit={sendCode} className="space-y-3">
          <div>
            <label htmlFor="signup-email" className="label">
              Your email
            </label>
            <input
              id="signup-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn-cta w-full py-3" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
          <p className="text-center text-xs text-zinc-400">
            By continuing you agree to our{" "}
            <Link href="/legal/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline">
              Privacy Policy
            </Link>
            . crowdpick is for adults 18+.
          </p>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-zinc-600">
            We sent a 6-digit code to <span className="text-ink">{email}</span>. It expires in 10 minutes.
          </p>
          {devCode && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Dev mode: your code is {devCode}</p>}
          <div>
            <label htmlFor="signup-code" className="label">
              Code
            </label>
            <input
              id="signup-code"
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
            <button
              type="button"
              className="text-zinc-500"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        </form>
      )}

      {step === "username" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            // Already answered in the Vote deck (about-you cards): nothing left to ask.
            if (sex && ageRange) finish();
            else setStep("about");
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="signup-handle" className="label">
              Pick a username <span className="text-b">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">@</span>
              <input
                id="signup-handle"
                autoFocus
                required
                autoCapitalize="none"
                autoComplete="username"
                className="input !pl-7"
                maxLength={20}
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">3–20 letters, numbers or underscores. You can change it later.</p>
          </div>
          <button className="btn-cta w-full py-3" disabled={!HANDLE_RE.test(handle)}>
            Continue
          </button>
        </form>
      )}

      {step === "about" && (
        <form onSubmit={finish} className="space-y-4">
          <p className="text-sm text-zinc-600">This helps us match you with people like you.</p>
          <ChipGroup
            label="Sex (optional)"
            options={SEX_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={sex ? [sex] : []}
            onChange={(v) => setSex(v[0] ?? "")}
            single
          />
          <ChipGroup
            label="Your age (optional)"
            options={AGE_RANGES.map((o) => ({ id: o.id, label: o.label }))}
            value={ageRange ? [ageRange] : []}
            onChange={(v) => setAgeRange(v[0] ?? "")}
            single
          />
          <button className="btn-cta w-full py-3" disabled={busy}>
            {busy ? "Finishing…" : finishLabel}
          </button>
          <button type="button" className="w-full text-sm text-zinc-500" onClick={() => setStep("username")}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}

