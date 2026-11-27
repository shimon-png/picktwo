import { describe, it, expect } from "vitest";
import { isGenericPhoto, genericFactor } from "@/server/services/ranking";

describe("isGenericPhoto", () => {
  const g = (title: string, photos = 2, context: string | null = null) => isGenericPhoto({ title, photos, context });
  it("flags bare X or Y photo cards", () => {
    expect(g("Coffee or Tea?")).toBe(true);
    expect(g("Sandwiches or Shrimp?")).toBe(true);
    expect(g("White dress or Brown dress?")).toBe(true);
    expect(g("After sunrise or Before sunrise?")).toBe(true);
  });
  it("leaves text cards, stories and personal stakes alone", () => {
    expect(g("Coffee or Tea?", 0)).toBe(false);
    expect(g("Coffee or Tea?", 2, "First date tomorrow at 8am.")).toBe(false);
    expect(g("My wedding: lilies or roses?")).toBe(false);
    expect(g("Kitchen cabinet color")).toBe(false);
    expect(g("Trying to fix my sleep schedule. Become a morning person or accept I'm a night owl?")).toBe(false);
  });
  it("genericFactor applies the penalty only when on", () => {
    expect(genericFactor(true, 0.3)).toBe(0.3);
    expect(genericFactor(false, 0.3)).toBe(1);
    expect(genericFactor(true, 1)).toBe(1);
    expect(genericFactor(true, 0)).toBe(1);
  });
});
