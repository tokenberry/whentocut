/**
 * Steam seasonal & themed sale calendar.
 *
 * Seasonal sales (Spring/Summer/Autumn/Winter) are the highest-visibility windows
 * and are exempt from the 30-day discount cooldown, so the recommendation engine
 * prefers aligning discounts to them. Dates shift slightly year to year and are
 * announced by Valve; this is a maintained config. Update annually.
 *
 * Dates are inclusive [start, end] in UTC (YYYY-MM-DD).
 */

export type SaleKind = "seasonal" | "themed";

export interface SteamSale {
  name: string;
  kind: SaleKind;
  start: string; // YYYY-MM-DD (UTC)
  end: string; // YYYY-MM-DD (UTC)
  /** Seasonal sales are exempt from the 30-day cooldown; most themed sales are not. */
  cooldownExempt: boolean;
}

/**
 * Known and projected Steam sale windows. Seasonal sales recur on a stable cadence
 * (late Feb/Mar, late Jun, late Sep/Oct, late Dec), so future entries are reasonable
 * projections until Valve confirms exact dates.
 */
export const STEAM_SALES: SteamSale[] = [
  // 2026
  { name: "Spring Sale 2026", kind: "seasonal", start: "2026-03-12", end: "2026-03-19", cooldownExempt: true },
  { name: "Summer Sale 2026", kind: "seasonal", start: "2026-06-25", end: "2026-07-09", cooldownExempt: true },
  { name: "Autumn Sale 2026", kind: "seasonal", start: "2026-11-25", end: "2026-12-02", cooldownExempt: true },
  { name: "Winter Sale 2026", kind: "seasonal", start: "2026-12-18", end: "2027-01-05", cooldownExempt: true },
  // 2027 (projected)
  { name: "Spring Sale 2027", kind: "seasonal", start: "2027-03-11", end: "2027-03-18", cooldownExempt: true },
  { name: "Summer Sale 2027", kind: "seasonal", start: "2027-06-24", end: "2027-07-08", cooldownExempt: true },
];

function toDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

/** Whether `now` falls within any sale window. Returns the sale, or null. */
export function activeSale(now: Date, sales: SteamSale[] = STEAM_SALES): SteamSale | null {
  const t = now.getTime();
  for (const s of sales) {
    if (t >= toDate(s.start).getTime() && t <= toDate(s.end).getTime() + 86_400_000 - 1) {
      return s;
    }
  }
  return null;
}

/** The next seasonal sale starting strictly after `now`, or null if none in the calendar. */
export function nextSeasonalSale(now: Date, sales: SteamSale[] = STEAM_SALES): SteamSale | null {
  const upcoming = sales
    .filter((s) => s.kind === "seasonal" && toDate(s.start).getTime() > now.getTime())
    .sort((a, b) => toDate(a.start).getTime() - toDate(b.start).getTime());
  return upcoming[0] ?? null;
}

export function daysUntil(target: string, now: Date): number {
  return Math.ceil((toDate(target).getTime() - now.getTime()) / 86_400_000);
}
