import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/server/viewer";
import { signOut } from "@/server/auth";
import { ProfileForm } from "@/components/layout/ProfileForm";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import { suggestHandle } from "@/server/services/profile";
import Link from "next/link";
import { AvatarEditor } from "@/components/layout/AvatarEditor";
import { TOUR_URL } from "@/lib/tour";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ enable?: string; returnTo?: string }> }) {
  const sp = await searchParams;
  // "Turn on messages" round trip: /settings?enable=chat&returnTo=/messages/maya brings you back after switching it on.
  const returnTo = sp.returnTo && sp.returnTo.startsWith("/") && !sp.returnTo.startsWith("//") ? sp.returnTo : null;
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/settings");
  const panel = (
    <SettingsPanel initial={{ notifyEmail: user.notifyEmail, marketingEmail: user.marketingEmail, dataConsent: user.dataConsent, showInVoteMatches: user.showInVoteMatches, chatEnabled: user.chatEnabled }} emailPrefs={user.emailPrefs} focusChat={sp.enable === "chat"} returnTo={returnTo} />
  );
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  return (
    <div className="space-y-8">
      <h1 className=" text-2xl font-medium">Settings</h1>
      {sp.enable === "chat" && panel}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Profile</h2>
        <AvatarEditor image={user.image} name={user.name || user.handle || "?"} />
        <ProfileForm
          mode="settings"
          initial={{
            name: user.name ?? "",
            handle: user.handle ?? (await suggestHandle(user.email)),
            bio: user.bio ?? "",
            kidAges: user.kidAges,
            kidsStatus: user.kidsStatus ?? (user.kidAges.length ? "YES" : ""),
            country: user.country ?? "",
            region: user.region ?? "",
            city: user.city ?? "",
            zipCode: user.zipCode ?? "",
            sex: user.sex ?? "",
            ageRange: user.ageRange ?? "",
            interests: user.interests,
            dataConsent: user.dataConsent,
            isAdultConfirmed: true,
          }}
        />
      </section>
      {sp.enable !== "chat" && panel}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Tutorial</h2>
        <p className="text-sm text-zinc-600">The quick tour of how voting works. It only shows on your first visit; replay it any time.</p>
        <Link href={TOUR_URL} className="btn-outline">
          Replay tutorial
        </Link>
      </section>
      <div className="flex flex-wrap gap-2">
        <form action={logout}>
          <button className="btn-outline">Sign out</button>
        </form>
        {isAdmin(user) && (
          <Link href="/admin" className="btn-outline">
            Admin
          </Link>
        )}
      </div>
    </div>
  );
}
