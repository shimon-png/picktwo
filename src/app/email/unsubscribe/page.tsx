import Link from "next/link";
import { EMAIL_GROUP_LABELS } from "@/server/services/email-rules";
import { setEmailGroup, UNSUB_GROUPS, verifyUnsubscribe, type UnsubGroup } from "@/server/services/mailer";

export const metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The "Unsubscribe from these" link in every email. Asks first (mail scanners open links), then turns that group off. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ u?: string; g?: string; t?: string; done?: string }> }) {
  const sp = await searchParams;
  const u = sp.u ?? "";
  const g = sp.g ?? "";
  const ok = UNSUB_GROUPS.includes(g as UnsubGroup) && verifyUnsubscribe(u, g, sp.t ?? "");
  const label = ok ? EMAIL_GROUP_LABELS[g as UnsubGroup].label : "";

  async function unsubscribe() {
    "use server";
    if (ok) await setEmailGroup(u, g as UnsubGroup, false);
  }
  async function resubscribe() {
    "use server";
    if (ok) await setEmailGroup(u, g as UnsubGroup, true);
  }

  return (
    <div className="card mx-auto mt-10 max-w-sm space-y-4 p-6 text-center">
      {!ok ? (
        <>
          <h1 className="text-xl">This link doesn’t work</h1>
          <p className="text-sm text-zinc-600">
            You can change your emails in{" "}
            <Link href="/settings#email" className="underline">
              Settings
            </Link>
            .
          </p>
        </>
      ) : sp.done === "1" ? (
        <>
          <h1 className="text-xl">You’re unsubscribed</h1>
          <p className="text-sm text-zinc-600">We won’t send you “{label}” emails anymore.</p>
          <form action={resubscribe}>
            <button className="btn-outline">Undo</button>
          </form>
          <Link href="/settings#email" className="block text-sm underline">
            Manage all email settings
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-xl">Unsubscribe from “{label}”?</h1>
          <p className="text-sm text-zinc-600">{EMAIL_GROUP_LABELS[g as UnsubGroup].desc}.</p>
          <form
            action={async () => {
              "use server";
              await unsubscribe();
              const { redirect } = await import("next/navigation");
              redirect(`/email/unsubscribe?u=${encodeURIComponent(u)}&g=${g}&t=${encodeURIComponent(sp.t ?? "")}&done=1`);
            }}
          >
            <button className="btn-primary w-full">Unsubscribe</button>
          </form>
        </>
      )}
    </div>
  );
}
