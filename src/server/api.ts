import { headers } from "next/headers";
import { errorResponse } from "./errors";

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler with uniform error handling (PRD 11.2). */
export function handler<P = Record<string, string>>(fn: (req: Request, ctx: Ctx<P>) => Promise<Response | object | void>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function json<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
