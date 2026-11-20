import { getCurrentUser } from "@/server/viewer";
import { ContactForm } from "@/components/contact/ContactForm";
import { CONTACT_TOPICS } from "@/lib/validators";

export const metadata = { title: "Contact us" };
export const dynamic = "force-dynamic";

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const [user, { topic }] = await Promise.all([getCurrentUser(), searchParams]);
  const validTopic = CONTACT_TOPICS.some((t) => t.id === topic) ? topic : undefined;
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-medium">Contact us</h1>
        <p className="text-sm text-zinc-600">Questions, problems, safety concerns or ideas: send them to the crowdpick.ai team here.</p>
      </div>
      <ContactForm initial={{ name: user?.name ?? "", email: user?.email ?? "", topic: validTopic }} />
    </div>
  );
}
