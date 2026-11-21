import { z } from "zod";
import { clientIp, handler } from "@/server/api";
import { rateLimit } from "@/server/ratelimit";
import { listCities, listCountries, listStates } from "@/server/services/geo";
import { checkZipTarget, lookupZip } from "@/server/services/zip";

const q = z.object({
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),
  state: z.string().trim().max(80).optional(),
  level: z.enum(["countries", "states", "cities", "zip", "zipTargets"]),
  code: z.string().trim().max(12).optional(),
  codes: z.string().trim().max(240).optional(),
});

/** GET /api/geo?level=countries | zip&code= | zipTargets&codes= | states&country=US | cities&country=US&state=New York */
export const GET = handler(async (req) => {
  await rateLimit("generic", `geo:${await clientIp()}`);
  const p = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  // ZIP checks: ?level=zip&code=10001[&country=US] → { ok, code, country, region, city } | { ok:false, message }
  if (p.level === "zip") return Response.json(lookupZip(p.code ?? "", p.country), { headers: { "Cache-Control": "public, max-age=86400" } });
  // Composer targeting: ?level=zipTargets&codes=941,10001 → { invalid: ["..."] }
  if (p.level === "zipTargets") {
    const list = (p.codes ?? "").split(/[,\s]+/).filter(Boolean).slice(0, 20);
    return Response.json({ invalid: list.filter((c) => !checkZipTarget(c)) }, { headers: { "Cache-Control": "public, max-age=86400" } });
  }
  const body =
    p.level === "countries"
      ? { items: listCountries() }
      : !p.country
        ? { items: [] }
        : p.level === "states"
          ? { items: listStates(p.country) }
          : { items: listCities(p.country, p.state || null) };
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } });
});
