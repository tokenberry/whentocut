import { describe, it, expect } from "vitest";
import { shouldAlert } from "./notify";
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
