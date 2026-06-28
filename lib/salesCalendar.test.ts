import { describe, it, expect } from "vitest";
import { activeSale, nextSeasonalSale, daysUntil, SteamSale } from "./salesCalendar";

const SALES: SteamSale[] = [
  { name: "Summer", kind: "seasonal", start: "2026-06-25", end: "2026-07-09", cooldownExempt: true },
  { name: "Winter", kind: "seasonal", start: "2026-12-18", end: "2027-01-05", cooldownExempt: true },
];

describe("activeSale", () => {
  it("detects a date inside a sale window (inclusive of end day)", () => {
    expect(activeSale(new Date("2026-06-25T12:00:00Z"), SALES)?.name).toBe("Summer");
    expect(activeSale(new Date("2026-07-09T23:00:00Z"), SALES)?.name).toBe("Summer");
  });

  it("returns null outside any window", () => {
    expect(activeSale(new Date("2026-08-01T00:00:00Z"), SALES)).toBeNull();
  });
});

describe("nextSeasonalSale", () => {
  it("returns the soonest seasonal sale after now", () => {
    expect(nextSeasonalSale(new Date("2026-08-01T00:00:00Z"), SALES)?.name).toBe("Winter");
  });

  it("does not return a sale that already started", () => {
    expect(nextSeasonalSale(new Date("2026-06-26T00:00:00Z"), SALES)?.name).toBe("Winter");
  });
});

describe("daysUntil", () => {
  it("counts days to a target date", () => {
    expect(daysUntil("2026-06-25", new Date("2026-06-20T00:00:00Z"))).toBe(5);
  });
});
