import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import journal from "../../drizzle/meta/_journal.json";

// Drizzle's migrator only applies a migration whose `when` is newer than the last
// applied one. An out-of-order timestamp (e.g. after renumbering in a merge) is
// silently skipped in production. This happened with 0030_email_log (Nov 23 2026).
describe("drizzle migration journal", () => {
  it("has strictly increasing timestamps", () => {
    const entries = journal.entries;
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].when, `${entries[i].tag} must be newer than ${entries[i - 1].tag}`).toBeGreaterThan(entries[i - 1].when);
    }
  });

  it("lists every .sql file exactly once", () => {
    const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).map((f) => f.replace(/\.sql$/, "")).sort();
    const tags = journal.entries.map((e) => e.tag).sort();
    expect(files).toEqual(tags);
  });
});
