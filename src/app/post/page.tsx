import { redirect } from "next/navigation";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { getCurrentUser, isAdmin } from "@/server/viewer";
import { getEconomy } from "@/server/services/config";
import { countOpenLoops } from "@/server/services/points";
import { ComposeForm } from "@/components/compose/ComposeForm";

export const metadata = { title: "New battle" };

export default async function PostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/post");
  if (profileIncomplete(user)) redirect(onboardingUrl("/post"));
  const economy = await getEconomy();
  const openLoops = await countOpenLoops(user.id, economy);
  return (
    <ComposeForm
      pp={user.ppBalance}
      tiers={{ highAt: economy.tierHighAt, topAt: economy.tierTopAt }}
      openLoops={openLoops}
      accountConsent={user.dataConsent}
      isAdmin={isAdmin(user)}
    />
  );
}
