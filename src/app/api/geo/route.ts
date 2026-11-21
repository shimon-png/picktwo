import { z } from "zod";
import { clientIp, handler } from "@/server/api";
import { rateLimit } from "@/server/ratelimit";
import { listCities, listCountries, listStates } from "@/server/services/geo";

const q = z.object({
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),
  state: z.string().trim().max(80).optional(),
  level: z.enum(["countries", "states", "cities"]),
});

/** GET /api/geo?level=countries | states&country=US | cities&country=US&state=New York */
export const GET = handler(async (req) => {
  await rateLimit("generic", `geo:${await clientIp()}`);
  const p = q.parse(Object.fromEntries(new URL(req.url).searchParams));
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
