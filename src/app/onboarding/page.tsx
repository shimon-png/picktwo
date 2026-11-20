import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import { ProfileForm } from "@/components/layout/ProfileForm";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/onboarding");
  const { next } = await searchParams;
  const returning = !!user.onboardedAt;
  const suggested = user.handle ?? (user.email?.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return (
    <div className="space-y-6">
      <div>
        <h1 className=" text-2xl font-medium">{returning ? "Finish your profile" : "Set up your profile"}</h1>
        <p className="text-zinc-600">
          {returning
            ? "We now ask everyone for a ZIP code, sex and age range. It takes a few seconds and helps us match you with people like you."
            : "Takes 30 seconds. This helps us show your battles to the right people."}
        </p>
      </div>
      <ProfileForm
        mode="onboarding"
        returning={returning}
        next={next && next.startsWith("/") ? next : "/"}
        initial={{
          name: user.name ?? "",
          handle: suggested.length >= 3 ? suggested : "",
          bio: user.bio ?? "",
          kidAges: user.kidAges,
          country: user.country ?? "",
          region: user.region ?? "",
          zipCode: user.zipCode ?? "",
          sex: user.sex ?? "",
          ageRange: user.ageRange ?? "",
          interests: user.interests,
          dataConsent: user.dataConsent,
          isAdultConfirmed: user.isAdultConfirmed,
        }}
      />
    </div>
  );
}
