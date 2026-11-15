import { handler } from "@/server/api";
import { requireUser } from "@/server/viewer";
import { outcomeInput } from "@/lib/validators";
import { reportOutcome } from "@/server/services/outcomes";

export const POST = handler<{ slug: string }>(async (req, { params }) => {
  const { slug } = await params;
  const user = await requireUser();
  const input = outcomeInput.parse(await req.json());
  return reportOutcome(slug, user, input);
});
