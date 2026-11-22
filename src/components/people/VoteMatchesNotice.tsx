import Link from "next/link";
import { EyeOff } from "lucide-react";

/** Explains who can see you in "Voted like you", and where to turn it off. */
export function VoteMatchesNotice({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <div className="card flex gap-3 p-4 text-sm">
      <EyeOff className="mt-0.5 size-5 shrink-0 text-zinc-500" aria-hidden />
      <p>
        You’re hidden from “Voted like you”, so you can’t see who voted like you either.{" "}
        <Link href="/settings#privacy" className="text-accent underline">
          Turn it on in Settings
        </Link>
        .
      </p>
    </div>
  ) : (
    <p className="text-[13px] text-zinc-500">
      Only signed-in people who picked the same side can see each other here. Guests and anyone who turned it off aren’t listed.{" "}
      <Link href="/settings#privacy" className="underline">
        Privacy settings
      </Link>
    </p>
  );
}
