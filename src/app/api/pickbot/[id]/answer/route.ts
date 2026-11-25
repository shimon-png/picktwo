import { getCurrentUser } from "@/server/viewer";
import { rateLimit } from "@/server/ratelimit";
import { errorResponse } from "@/server/errors";
import { answerThread } from "@/server/services/pickbot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Separates the streamed answer JSON from the closing metadata line. */
const END = "\u0000";

/**
 * Streams Pickbot's answer: the model's JSON text as it arrives, then END + a JSON line with the saved message
 * (or { error }). Errors before the first byte come back as normal JSON errors.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await getCurrentUser();
    await rateLimit("pickbotAnswer", user?.id ?? "anon");
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const done = await answerThread(user, id, (chunk) => controller.enqueue(enc.encode(chunk.replaceAll(END, ""))));
          controller.enqueue(enc.encode(END + JSON.stringify(done)));
        } catch (e) {
          const res = errorResponse(e);
          const j = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
          controller.enqueue(enc.encode(END + JSON.stringify({ error: j.error ?? { message: "Something went wrong" } })));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
  } catch (e) {
    return errorResponse(e);
  }
}
