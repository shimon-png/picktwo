import { z } from "zod";
import { handler } from "@/server/api";
import { requireAdmin } from "@/server/viewer";
import { getConfig, setConfig } from "@/server/services/config";
import { ECONOMY_DEFAULTS } from "@/lib/constants";

export const GET = handler(async () => {
  await requireAdmin();
  return getConfig();
});

export const POST = handler(async (req) => {
  await requireAdmin();
  const body = z.object({ economy: z.record(z.number()).optional(), features: z.record(z.union([z.number(), z.boolean()])).optional() }).parse(await req.json());
  if (body.economy) {
    const clean = Object.fromEntries(Object.entries(body.economy).filter(([k, v]) => k in ECONOMY_DEFAULTS && Number.isFinite(v)));
    await setConfig("economy", clean);
  }
  if (body.features) await setConfig("features", body.features);
  return getConfig();
});
