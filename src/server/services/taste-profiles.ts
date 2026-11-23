import { sql } from "drizzle-orm";
import { db } from "../db";
import { AGE_RANGES, SEX_OPTIONS } from "@/lib/constants";
import { addTraits, MIN_GROUP_PEOPLE, topLifts, type TraitCounts } from "./taste-rules";

/**
 * Taste profiles from picks on AI-tagged battles (data brain Phase 2b). Only real votes by signed-in people who
 * turned on data consent ("use my battles anonymised to improve recommendations"). Groups only on the Brain page.
 */

type PickRow = { user_id: string; sex: string | null; age_range: string | null; traits: string[] };

async function consentedPicks(): Promise<PickRow[]> {
  return db.execute<PickRow>(sql`
    SELECT v.user_id, u.sex, u.age_range,
      ARRAY(SELECT jsonb_array_elements_text(b.tags->'brain'->(CASE WHEN v.side = 'A' THEN 'a' ELSE 'b' END))) AS traits
    FROM vote v
    JOIN battle b ON b.id = v.battle_id
    JOIN "user" u ON u.id = v.user_id
    WHERE COALESCE(v.source, '') <> 'seed' AND NOT v.flagged
      AND b.tags ? 'brain' AND u.data_consent AND u.banned_at IS NULL AND u.email IS NOT NULL`);
}

const label = (list: readonly { id: string; label: string }[], id: string | null) => list.find((x) => x.id === id)?.label ?? "Not given";

/** Brain page: for each sex × age group with enough people, the traits it leans toward vs everyone. */
export async function tasteByGroup() {
  const rows = await consentedPicks();
  const everyone: TraitCounts = {};
  const groups = new Map<string, { sex: string | null; age: string | null; people: Set<string>; picks: number; traits: TraitCounts }>();
  for (const r of rows) {
    addTraits(everyone, r.traits);
    const key = `${r.sex ?? "?"}|${r.age_range ?? "?"}`;
    const g = groups.get(key) ?? { sex: r.sex, age: r.age_range, people: new Set<string>(), picks: 0, traits: {} };
    g.people.add(r.user_id);
    g.picks++;
    addTraits(g.traits, r.traits);
    groups.set(key, g);
  }
  const people = new Set(rows.map((r) => r.user_id)).size;
  const shown = [...groups.values()]
    .filter((g) => g.people.size >= MIN_GROUP_PEOPLE)
    .map((g) => ({
      group: `${label(SEX_OPTIONS, g.sex)}, ${label(AGE_RANGES, g.age)}`,
      people: g.people.size,
      picks: g.picks,
      leans: topLifts(g.traits, everyone),
    }))
    .sort((a, b) => b.people - a.people);
  return { people, picks: rows.length, minGroup: MIN_GROUP_PEOPLE, groups: shown };
}

/** Internal (engine use only, never shown to anyone): one consenting person's trait counts. */
export async function tasteProfile(userId: string): Promise<TraitCounts> {
  const rows = await db.execute<{ traits: string[] }>(sql`
    SELECT ARRAY(SELECT jsonb_array_elements_text(b.tags->'brain'->(CASE WHEN v.side = 'A' THEN 'a' ELSE 'b' END))) AS traits
    FROM vote v JOIN battle b ON b.id = v.battle_id JOIN "user" u ON u.id = v.user_id
    WHERE v.user_id = ${userId} AND u.data_consent AND b.tags ? 'brain' AND NOT v.flagged`);
  return rows.reduce((acc, r) => addTraits(acc, r.traits), {} as TraitCounts);
}
