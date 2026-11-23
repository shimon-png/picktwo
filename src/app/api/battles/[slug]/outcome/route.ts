import { after } from "next/server";
import { handler } from "@/server/api";
import { queueOutcomeEmails } from "@/server/services/lifecycle";
import { requireUser } from "@/server/viewer";
import { outcomeInput } from "@/lib/validators";
import { reportOutcome } from "@/server/services/outcomes";

export const POST = handler<{ slug: string }>(async (req, { params }) => {
  const { slug } = await params;
  const user = await requireUser();
  const input = outcomeInput.parse(await req.json());
  const res = await reportOutcome(slug, user, input);
  if (!res.edited) after(() => queueOutcomeEmails(slug));
  return res;
});
