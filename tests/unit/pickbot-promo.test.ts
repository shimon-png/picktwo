import { describe, expect, it } from "vitest";
import { PROMO_POSITIONS, promoDue, promoPosition } from "@/lib/pickbot-promo";
import { hashUnit } from "@/server/services/ranking";

describe("Ask Pickbot deck card", () => {
  it("never lands in the first 3 cards", () => {
    expect(Math.min(...PROMO_POSITIONS)).toBeGreaterThan(3);
  });
  it("gives each account a stable position, spread over every arm", () => {
    expect(promoPosition("user_abc")).toBe(promoPosition("user_abc"));
    const counts = new Map<number, number>();
    for (let i = 0; i < 8000; i++) {
      const p = promoPosition(`u${i}`);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([...PROMO_POSITIONS]);
    for (const n of counts.values()) expect(n).toBeGreaterThan(800);
  });
  it("uses the same hash as the server's ranking", () => {
    const i = Math.floor(hashUnit("pbpromo:user_abc") * PROMO_POSITIONS.length);
    expect(promoPosition("user_abc")).toBe(PROMO_POSITIONS[i]);
  });
  it("shows once, after enough picks, never over another card", () => {
    expect(promoDue({ picks: 5, at: 6, shown: false, busy: false })).toBe(false);
    expect(promoDue({ picks: 6, at: 6, shown: false, busy: false })).toBe(true);
    expect(promoDue({ picks: 7, at: 6, shown: false, busy: true })).toBe(false);
    expect(promoDue({ picks: 9, at: 6, shown: true, busy: false })).toBe(false);
  });
});
