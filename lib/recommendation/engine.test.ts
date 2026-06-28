import { describe, it, expect } from "vitest";
import { recommend } from "./engine";
import { RecommendationInput } from "./types";
import { SteamSale } from "../salesCalendar";

// Deterministic test calendar so tests don't depend on the real shipping dates.
const SALES: SteamSale[] = [
  { name: "Test Summer Sale", kind: "seasonal", start: "2026-06-25", end: "2026-07-09", cooldownExempt: true },
  { name: "Test Winter Sale", kind: "seasonal", start: "2026-12-18", end: "2027-01-05", cooldownExempt: true },
];

function baseInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    currentPriceCents: 1999,
    basePriceCents: 1999,
    currentDiscountPct: 0,
    releaseDate: "2024-01-01", // well-aged by default
    lastDiscountEndedAt: null,
    lastPriceIncreaseAt: null,
    priorDiscountCount: 0,
    playerTrend: 0,
    rivalsOnSaleFraction: 0,
    wishlistCount: null,
    recentWishlistAdds: null,
    now: new Date("2026-02-01T00:00:00Z"), // off-season, far from any sale
    ...overrides,
  };
}

describe("recommend — hard Steam constraints", () => {
  it("blocks during the 30-day discount cooldown", () => {
    const rec = recommend(
      baseInput({
        lastDiscountEndedAt: "2026-01-20", // 12 days before "now"
        now: new Date("2026-02-01T00:00:00Z"),
      }),
      SALES,
    );
    expect(rec.action).toBe("blocked");
    expect(rec.suggestedDiscountPct).toBeNull();
    expect(rec.reasons.join(" ")).toMatch(/cooldown/i);
  });

  it("blocks during the 30-day post-price-increase lockout", () => {
    const rec = recommend(
      baseInput({
        lastPriceIncreaseAt: "2026-01-25", // 7 days before "now"
        now: new Date("2026-02-01T00:00:00Z"),
      }),
      SALES,
    );
    expect(rec.action).toBe("blocked");
    expect(rec.reasons.join(" ")).toMatch(/price increase|price-increase/i);
  });

  it("clears the cooldown after 30 days", () => {
    const rec = recommend(
      baseInput({
        lastDiscountEndedAt: "2025-12-15", // >30 days before
        now: new Date("2026-02-01T00:00:00Z"),
      }),
      SALES,
    );
    expect(rec.action).not.toBe("blocked");
  });
});

describe("recommend — launch window", () => {
  it("holds full price within the first 90 days", () => {
    const rec = recommend(
      baseInput({
        releaseDate: "2026-01-15", // ~17 days old at "now"
        now: new Date("2026-02-01T00:00:00Z"),
      }),
      SALES,
    );
    expect(rec.action).toBe("hold");
    expect(rec.reasons.join(" ")).toMatch(/launch window|since release/i);
  });
});

describe("recommend — seasonal alignment", () => {
  it("recommends discounting now when a seasonal sale is live", () => {
    const rec = recommend(
      baseInput({ now: new Date("2026-06-26T00:00:00Z") }), // inside Summer Sale
      SALES,
    );
    expect(rec.action).toBe("discount_now");
    expect(rec.window?.label).toBe("Test Summer Sale");
    expect(rec.suggestedDiscountPct).toBe(20); // first discount
  });

  it("recommends scheduling now when a seasonal sale is imminent", () => {
    const rec = recommend(
      baseInput({ now: new Date("2026-06-20T00:00:00Z") }), // 5 days before Summer Sale
      SALES,
    );
    expect(rec.action).toBe("discount_now");
    expect(rec.window?.label).toBe("Test Summer Sale");
    expect(rec.actByDate).not.toBeNull();
  });
});

describe("recommend — depth escalation", () => {
  it("deepens the discount with prior discount count", () => {
    const now = new Date("2026-06-26T00:00:00Z"); // live sale
    expect(recommend(baseInput({ now, priorDiscountCount: 0 }), SALES).suggestedDiscountPct).toBe(20);
    expect(recommend(baseInput({ now, priorDiscountCount: 1 }), SALES).suggestedDiscountPct).toBe(25);
    expect(recommend(baseInput({ now, priorDiscountCount: 2 }), SALES).suggestedDiscountPct).toBe(33);
    expect(recommend(baseInput({ now, priorDiscountCount: 9 }), SALES).suggestedDiscountPct).toBe(50); // clamped
  });
});

describe("recommend — off-season demand steering", () => {
  it("steers a declining game toward the next seasonal sale", () => {
    const rec = recommend(
      baseInput({
        now: new Date("2026-02-01T00:00:00Z"), // off-season
        playerTrend: -0.4,
      }),
      SALES,
    );
    expect(rec.action).toBe("schedule_for_sale");
    expect(rec.window?.label).toBe("Test Summer Sale");
  });

  it("holds when demand is stable and no sale is near", () => {
    const rec = recommend(baseInput({ now: new Date("2026-02-01T00:00:00Z") }), SALES);
    expect(rec.action).toBe("hold");
  });
});

describe("recommend — value-erosion guardrail", () => {
  it("trips when discounting too frequently for the game's age", () => {
    const rec = recommend(
      baseInput({
        now: new Date("2026-06-26T00:00:00Z"), // live sale -> would be discount_now
        releaseDate: "2026-01-01", // ~half a year old
        priorDiscountCount: 4, // >4/yr rate
      }),
      SALES,
    );
    expect(rec.reasons.join(" ")).toMatch(/value-erosion|guardrail/i);
    expect(rec.confidence).toBeLessThan(0.85);
  });
});

describe("recommend — already discounted", () => {
  it("holds when a discount is currently live on the store", () => {
    const rec = recommend(baseInput({ currentDiscountPct: 25 }), SALES);
    expect(rec.action).toBe("hold");
    expect(rec.reasons.join(" ")).toMatch(/already discounted/i);
  });
});
