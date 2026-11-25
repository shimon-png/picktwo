import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/viewer";
import { ProfileForm } from "@/components/layout/ProfileForm";
import { suggestHandle } from "@/server/services/profile";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/onboarding");
  const { next } = await searchParams;
  const returning = !!user.onboardedAt;
  // Username starts from the email (the account identifier); editable.
  const suggested = user.handle ?? (await suggestHandle(user.email));
  return (
    <div className="space-y-6">
      <div>
        <h1 className=" text-2xl font-medium">{returning ? "Finish your profile" : "Set up your profile"}</h1>
        <p className="text-zinc-600">
          {returning
            ? "A ZIP code, sex and age range are optional, but they let us show you how people like you voted."
            : "Takes 30 seconds. This helps us show your battles to the right people."}
        </p>
      </div>
      <ProfileForm
        mode="onboarding"
        returning={returning}
        next={next && next.startsWith("/") ? next : "/"}
        initial={{
          name: user.name ?? "",
          handle: suggested,
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
          isAdultConfirmed: user.isAdultConfirmed,
        }}
      />
    </div>
  );
}
