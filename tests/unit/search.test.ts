import { describe, it, expect } from "vitest";
import { cleanQuery, likeEscape } from "@/lib/search";

describe("search helpers", () => {
  it("cleans queries", () => {
    expect(cleanQuery("  @Ellen  ")).toBe("Ellen");
    expect(cleanQuery("baby   toys")).toBe("baby toys");
    expect(cleanQuery(undefined)).toBe("");
    expect(cleanQuery("x".repeat(200))).toHaveLength(80);
  });
  it("escapes LIKE wildcards", () => {
    expect(likeEscape("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
