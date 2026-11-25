"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { logEvent } from "@/lib/events";
import { OneTapSignup } from "./OneTapSignup";

type Props = {
  limit?: number;
  next: string;
  onClose?: () => void;
  /** Sign-up gate test, group B: a closable "sign up or keep voting" dialog instead of a wall. */
  soft?: boolean;
  /** Where it opened (deck, home, battle, discover) + extra event props, for the data brain. */
  place: string;
  log?: Record<string, string | number | undefined>;
};

/** "Sign up to keep voting": shown to signed-out visitors once their free votes are used. */
export function SignupGate({ limit, next, onClose, soft = false, place, log }: Props) {
  const arm = soft ? "soft" : "control";
  useEffect(() => {
    logEvent("signup_gate_shown", { place, arm, limit, ...log });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = onClose
    ? () => {
        logEvent("signup_gate_closed", { place, arm, ...log });
        onClose();
      }
    : undefined;
  // One-tap sign-up (About-you plan §3b): everything we know is prefilled; Google or email + code finishes it.
  const body = <OneTapSignup next={next} soft={soft} />;
  if (!close)
    return (
      <section aria-label="Sign up to keep voting" className="mx-auto mt-2 max-w-md rounded-[14px] bg-white p-5 shadow-ring">
        {body}
      </section>
    );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={soft ? "Sign up, or keep voting" : "Sign up to keep voting"}
        className="relative w-full max-w-md rounded-t-[20px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" className="btn-ghost absolute right-2 top-2 !p-2" onClick={close}>
          <X className="size-4" aria-hidden />
        </button>
        {body}
        {soft && (
          <button type="button" className="mt-3 w-full py-2 text-sm text-zinc-500 underline underline-offset-2" onClick={close}>
            Not now, keep voting
          </button>
        )}
      </div>
    </div>
  );
}
