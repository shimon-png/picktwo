import { describe, expect, it } from "vitest";
import { monthWindow, neonCost, projectMonthEnd, sumFocusRows, sumOpenAiCosts, perUnit } from "@/server/services/finance-rules";

describe("finance rules", () => {
  it("builds the UTC month window", () => {
    const w = monthWindow(new Date("2026-11-16T00:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(w.days).toBe(30);
    expect(w.elapsed).toBe(15);
  });
  it("projects usage straight-line and adds fixed fees whole", () => {
    expect(projectMonthEnd(10, new Date("2026-11-16T00:00:00Z"), 20)).toBe(40);
    // under a day of data: no projection
    expect(projectMonthEnd(5, new Date("2026-11-01T06:00:00Z"))).toBe(5);
  });
  it("prices Neon usage", () => {
    const c = neonCost({ computeSeconds: 100 * 3600, storageByteHours: 744 * 2e9, transferBytes: 600e9 });
    expect(c.compute).toBeCloseTo(10.6);
    expect(c.storage).toBeCloseTo(0.7);
    expect(c.transfer).toBeCloseTo(10);
    expect(c.total).toBeCloseTo(21.3);
  });
  it("sums Vercel FOCUS JSONL, tolerating strings and junk lines", () => {
    const jsonl = [
      JSON.stringify({ BilledCost: "1.5", ServiceName: "Function Duration", ChargeCategory: "Usage" }),
      JSON.stringify({ BilledCost: 2, ServiceName: "Blob Storage", ChargeCategory: "Usage" }),
      JSON.stringify({ BilledCost: 0.5, ServiceName: "Function Duration", ChargeCategory: "Usage" }),
      JSON.stringify({ BilledCost: 20, ServiceName: "Pro Plan", ChargeCategory: "Purchase" }),
      "not json",
      "",
    ].join("\n");
    const f = sumFocusRows(jsonl);
    expect(f.usage).toBe(4);
    expect(f.other).toBe(20);
    expect(f.services[0]).toEqual({ name: "Pro Plan", cost: 20 });
    expect(f.services.find((s) => s.name === "Function Duration")?.cost).toBe(2);
  });
  it("sums OpenAI cost buckets", () => {
    expect(sumOpenAiCosts([{ data: [{ results: [{ amount: { value: 0.12 } }, { amount: { value: "0.3" } }] }, { results: [] }] }])).toBe(0.42);
    expect(sumOpenAiCosts([])).toBe(0);
  });
  it("unit cost is null with no activity", () => {
    expect(perUnit(10, 0)).toBeNull();
    expect(perUnit(10, 4)).toBe(2.5);
  });
});
