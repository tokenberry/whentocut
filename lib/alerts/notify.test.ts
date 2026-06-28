import { describe, it, expect } from "vitest";
import { shouldAlert, alertSignature } from "./notify";
import { Recommendation } from "../recommendation/types";

function rec(over: Partial<Recommendation>): Recommendation {
  return {
    action: "hold",
    suggestedDiscountPct: null,
    window: null,
    actByDate: null,
    confidence: 0.5,
    reasons: [],
    ...over,
  };
}

describe("shouldAlert", () => {
  it("alerts on discount_now", () => {
    expect(shouldAlert(rec({ action: "discount_now" }))).toBe(true);
  });

  it("alerts when a scheduling deadline is near", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    expect(
      shouldAlert(rec({ action: "schedule_for_sale", actByDate: "2026-06-20" }), now),
    ).toBe(true);
  });

  it("does not alert when the deadline is far off", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    expect(
      shouldAlert(rec({ action: "schedule_for_sale", actByDate: "2026-08-20" }), now),
    ).toBe(false);
  });

  it("does not alert on hold/blocked", () => {
    expect(shouldAlert(rec({ action: "hold" }))).toBe(false);
    expect(shouldAlert(rec({ action: "blocked" }))).toBe(false);
  });
});

describe("alertSignature", () => {
  it("is stable for the same actionable recommendation", () => {
    const a = rec({ action: "discount_now", suggestedDiscountPct: 20, window: { label: "Summer Sale 2026", start: "2026-06-25", end: "2026-07-09" } });
    const b = rec({ action: "discount_now", suggestedDiscountPct: 20, window: { label: "Summer Sale 2026", start: "2026-06-25", end: "2026-07-09" } });
    expect(alertSignature(a)).toBe(alertSignature(b));
  });

  it("changes when action, depth, or window changes", () => {
    const base = rec({ action: "discount_now", suggestedDiscountPct: 20, window: { label: "Summer Sale 2026", start: "2026-06-25", end: "2026-07-09" } });
    expect(alertSignature(base)).not.toBe(
      alertSignature({ ...base, suggestedDiscountPct: 25 }),
    );
    expect(alertSignature(base)).not.toBe(
      alertSignature({ ...base, action: "schedule_for_sale" }),
    );
  });
});
