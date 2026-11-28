import { after } from "next/server";
import { handler } from "@/server/api";
import { queueOutcomeEmails } from "@/server/services/lifecycle";
import { requireUser } from "@/server/viewer";
import { outcomeInput } from "@/lib/validators";
import { reportBattleOutcome } from "@/server/services/pickbot";

export const POST = handler<{ slug: string }>(async (req, { params }) => {
  const { slug } = await params;
  const user = await requireUser();
  const input = outcomeInput.parse(await req.json());
  const res = await reportBattleOutcome(slug, user, input);
  // Pickbot crowd questions keep the asker anonymous: no outcome emails naming them.
  if (!res.edited && !res.pickbotAsker) after(() => queueOutcomeEmails(slug));
  return res;
});
