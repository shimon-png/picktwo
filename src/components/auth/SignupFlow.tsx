"use client";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { AGE_RANGES, SEX_OPTIONS } from "@/lib/constants";
import { ZIP_RE } from "@/lib/validators";
import { ChipGroup } from "@/components/compose/ComposeForm";

type Step = "email" | "code" | "about" | "zip";
const STEPS: Step[] = ["email", "code", "about", "zip"];
type Status = { complete: boolean; sex: string | null; ageRange: string | null; zipCode: string | null };

const CODE_ERRORS: Record<string, string> = {
  invalid: "That code isn’t right. Check the email and try again.",
  expired: "That code has expired. Tap “Send a new code”.",
  too_many: "Too many tries. Tap “Send a new code”.",
};

/**
 * Sign up / sign in in 4 steps: email → 6-digit code → sex + age → ZIP.
 * Existing users with a complete profile finish after the code. Ends with a full page load of `next`
 * so the server links this device (and its guest votes) to the account.
 */
export function SignupFlow({ next, intro, finishLabel = "Finish" }: { next: string; intro?: React.ReactNode; finishLabel?: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
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
        setError(CODE_ERRORS[r?.code ?? ""] ?? CODE_ERRORS.invalid);
        return;
      }
      const s = await api<Status>("/api/me/quick-profile");
      if (s.complete) return done();
      setSex(s.sex ?? "");
      setAgeRange(s.ageRange ?? "");
      setZip(s.zipCode ?? "");
      setStep("about");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/quick-profile", { body: { sex, ageRange, zipCode: zip } });
      done();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const n = STEPS.indexOf(step) + 1;
  const zipOk = ZIP_RE.test(zip.trim().toUpperCase());

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
          <button className="btn-primary w-full py-3" disabled={busy || !email.trim()}>
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
          <button className="btn-primary w-full py-3" disabled={busy || code.length !== 6}>
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

      {step === "about" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep("zip");
          }}
          className="space-y-4"
        >
          <p className="text-sm text-zinc-600">This helps us match you with people like you.</p>
          <ChipGroup
            label={<>Sex <span className="text-b">*</span></>}
            options={SEX_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={sex ? [sex] : []}
            onChange={(v) => setSex(v[0] ?? "")}
            single
          />
          <ChipGroup
            label={<>Your age <span className="text-b">*</span></>}
            options={AGE_RANGES.map((o) => ({ id: o.id, label: o.label }))}
            value={ageRange ? [ageRange] : []}
            onChange={(v) => setAgeRange(v[0] ?? "")}
            single
          />
          <button className="btn-primary w-full py-3" disabled={!sex || !ageRange}>
            Continue
          </button>
        </form>
      )}

      {step === "zip" && (
        <form onSubmit={finish} className="space-y-3">
          <div>
            <label htmlFor="signup-zip" className="label">
              ZIP code <span className="text-b">*</span>
            </label>
            <input
              id="signup-zip"
              autoFocus
              required
              autoComplete="postal-code"
              className="input"
              placeholder="10001"
              maxLength={10}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full py-3" disabled={busy || !zipOk}>
            {busy ? "Finishing…" : finishLabel}
          </button>
          <button type="button" className="w-full text-sm text-zinc-500" onClick={() => setStep("about")}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}
