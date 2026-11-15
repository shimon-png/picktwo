import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import { ProfileForm } from "@/components/layout/ProfileForm";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/onboarding");
  const { next } = await searchParams;
  const suggested = user.handle ?? (user.email?.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Set up your profile</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Takes 30 seconds. This helps us show your battles to the right people.</p>
      </div>
      <ProfileForm
        mode="onboarding"
        next={next && next.startsWith("/") ? next : "/"}
        initial={{
          name: user.name ?? "",
          handle: suggested.length >= 3 ? suggested : "",
          bio: user.bio ?? "",
          kidAges: user.kidAges,
          country: user.country ?? "",
          region: user.region ?? "",
          interests: user.interests,
          dataConsent: user.dataConsent,
          isAdultConfirmed: user.isAdultConfirmed,
        }}
      />
    </div>
  );
}
