import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, enabledProviders } from "@/server/auth";
import { getCurrentUser } from "@/server/viewer";

export const metadata = { title: "Sign in" };

function safeCallback(cb?: string) {
  return cb && cb.startsWith("/") && !cb.startsWith("//") ? cb : "/";
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const callbackUrl = safeCallback(sp.callbackUrl);
  if (await getCurrentUser()) redirect(callbackUrl);

  async function emailAction(form: FormData) {
    "use server";
    const email = String(form.get("email") || "").trim().toLowerCase();
    try {
      await signIn("resend", { email, redirectTo: callbackUrl });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/signin?error=email&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      throw e;
    }
  }
  async function googleAction() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }
  async function devAction(form: FormData) {
    "use server";
    try {
      await signIn("dev", { email: String(form.get("email") || ""), redirectTo: callbackUrl });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/signin?error=dev&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      throw e;
    }
  }

  if (sp.sent)
    return (
      <div className="card mx-auto mt-10 max-w-sm space-y-3 p-6 text-center">
        <div className="text-4xl">📬</div>
        <h1 className=" text-xl font-medium">Check your email</h1>
        <p className="text-zinc-600">We sent you a sign-in link. It expires in 24 hours.</p>
        {!enabledProviders.emailConfigured && <p className="text-xs text-zinc-400">(Dev mode: the link is printed in the server console.)</p>}
      </div>
    );

  return (
    <div className="mx-auto mt-6 max-w-sm space-y-6">
      <div className="text-center">
        <h1 className=" text-2xl font-medium">Welcome to crowdpick</h1>
        <p className="text-zinc-600">Post battles, earn priority, and see how your picks turn out.</p>
      </div>
      {sp.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Something went wrong signing you in. Please try again.</p>}
      <div className="card space-y-4 p-5">
        {enabledProviders.google && (
          <form action={googleAction}>
            <button className="btn-outline w-full py-3">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8C3.9 20.5 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.9l3.6-2.8z" />
                <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7.1l3.6 2.8c.9-2.6 3.4-4.5 6.3-4.5z" />
              </svg>
              Continue with Google
            </button>
          </form>
        )}
        <form action={emailAction} className="space-y-2">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" autoComplete="email" />
          <button className="btn-primary w-full py-3">Email me a sign-in link</button>
        </form>
        {enabledProviders.dev && (
          <form action={devAction} className="space-y-2 border-t border-dashed border-zinc-300 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo login (DEV_LOGIN=true)</p>
            <input name="email" type="email" required className="input" placeholder="any@email.com" aria-label="Demo email" />
            <button className="btn-pp w-full">Sign in instantly</button>
          </form>
        )}
      </div>
      <p className="text-center text-xs text-zinc-400">
        By continuing you agree to our <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>. crowdpick is for adults 18+.
      </p>
    </div>
  );
}
