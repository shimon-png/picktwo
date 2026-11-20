import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/server/viewer";
import { signOut } from "@/server/auth";
import { ProfileForm } from "@/components/layout/ProfileForm";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import Link from "next/link";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/settings");
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  return (
    <div className="space-y-8">
      <h1 className=" text-2xl font-medium">Settings</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Profile</h2>
        <ProfileForm
          mode="settings"
          initial={{
            name: user.name ?? "",
            handle: user.handle ?? "",
            bio: user.bio ?? "",
            kidAges: user.kidAges,
            kidsStatus: user.kidsStatus ?? (user.kidAges.length ? "YES" : ""),
            country: user.country ?? "",
            region: user.region ?? "",
            zipCode: user.zipCode ?? "",
            sex: user.sex ?? "",
            ageRange: user.ageRange ?? "",
            interests: user.interests,
            dataConsent: user.dataConsent,
            isAdultConfirmed: true,
          }}
        />
      </section>
      <SettingsPanel initial={{ notifyEmail: user.notifyEmail, marketingEmail: user.marketingEmail, dataConsent: user.dataConsent }} />
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
