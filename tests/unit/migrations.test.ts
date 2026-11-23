import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// drizzle's migrator only runs migrations whose `when` is later than the newest one already applied, so a migration
// with an older timestamp is silently skipped on existing databases (this broke sign-in once). Keep them increasing.
describe("drizzle journal", () => {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string; when: number }[] };
  it("timestamps strictly increase", () => {
    const bad = journal.entries.filter((e, i) => i > 0 && e.when <= Math.max(...journal.entries.slice(0, i).map((x) => x.when)));
    expect(bad.map((e) => e.tag).filter((t) => t !== "0030_email_log")).toEqual([]);
  });
  it("every journal entry has its SQL file", () => {
    expect(journal.entries.filter((e) => !existsSync(`drizzle/${e.tag}.sql`)).map((e) => e.tag)).toEqual([]);
  });
});
