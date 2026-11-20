"use client";
import { X } from "lucide-react";
import { SignupFlow } from "./SignupFlow";

/** "Sign up to keep voting" — shown to signed-out visitors once their free votes are used. */
export function SignupGate({ limit, next, onClose }: { limit?: number; next: string; onClose?: () => void }) {
  const body = (
    <SignupFlow
      next={next}
      finishLabel="Finish and keep voting"
      intro={
        <div className="mt-4 space-y-1 text-center">
          <div className="text-4xl" aria-hidden>
            🎉
          </div>
          <h2 className="text-xl">{limit ? `You’ve voted on ${limit} battles!` : "You’ve used your free votes"}</h2>
          <p className="text-sm text-zinc-600">Sign up in 4 easy steps to keep voting. It’s free.</p>
        </div>
      }
    />
  );
  if (!onClose)
    return (
      <section aria-label="Sign up to keep voting" className="mx-auto mt-2 max-w-md rounded-[14px] bg-white p-5 shadow-ring">
        {body}
      </section>
    );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign up to keep voting"
        className="relative w-full max-w-md rounded-t-[20px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" className="btn-ghost absolute right-2 top-2 !p-2" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </button>
        {body}
      </div>
    </div>
  );
}
