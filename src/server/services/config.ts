import { db } from "../db";
import { appConfig } from "../db/schema";
import { ECONOMY_DEFAULTS, FEATURE_DEFAULTS, type Economy } from "@/lib/constants";

let cache: { at: number; economy: Economy; features: typeof FEATURE_DEFAULTS } | null = null;
const TTL = 30_000;

export async function getConfig() {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const rows = await db.select().from(appConfig);
  const econRow = rows.find((r) => r.key === "economy")?.value as Partial<Economy> | undefined;
  const featRow = rows.find((r) => r.key === "features")?.value as Partial<typeof FEATURE_DEFAULTS> | undefined;
  const economy = { ...ECONOMY_DEFAULTS, ...(econRow ?? {}) } as Economy;
  const features = { ...FEATURE_DEFAULTS, ...(featRow ?? {}) };
  cache = { at: Date.now(), economy, features };
  return cache;
}

export async function getEconomy(): Promise<Economy> {
  return (await getConfig()).economy;
}

export async function setConfig(key: "economy" | "features", value: Record<string, unknown>) {
  await db
    .insert(appConfig)
    .values({ key, value })
    .onConflictDoUpdate({ target: appConfig.key, set: { value, updatedAt: new Date() } });
  cache = null;
}
