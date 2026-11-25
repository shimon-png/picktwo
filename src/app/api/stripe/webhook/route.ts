import { errorResponse } from "@/server/errors";
import { handleStripeWebhook } from "@/server/services/plus";

export const dynamic = "force-dynamic";

/** Stripe → us. The raw body is needed for the signature check. */
export async function POST(req: Request) {
  try {
    return Response.json(await handleStripeWebhook(await req.text(), req.headers.get("stripe-signature")));
  } catch (e) {
    return errorResponse(e);
  }
}
