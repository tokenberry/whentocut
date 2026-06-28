/**
 * Pure helpers encoding Steam's real discount rules and accepted indie best practices.
 * Kept separate from engine.ts so each rule is independently unit-testable.
 *
 * Sources:
 * - 30-day discount cooldown & 30-day post-price-increase lockout:
 *   https://partner.steamgames.com/doc/marketing/discounts
 * - "ease in, deepen over time, sync to seasonal sales":
 *   https://partner.steamgames.com/doc/store/pricing
 */

export const DISCOUNT_COOLDOWN_DAYS = 30;
export const PRICE_INCREASE_LOCKOUT_DAYS = 30;
/** Don't recommend deep discounts before the game has had time to sell at full price. */
export const MIN_AGE_BEFORE_DISCOUNT_DAYS = 90;
/** Valve reviews price/discount changes; give the owner lead time to schedule. */
export const VALVE_REVIEW_LEAD_DAYS = 7;

const DAY_MS = 86_400_000;

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Days remaining on the 30-day cooldown since the last discount ended. 0 if clear. */
export function cooldownRemainingDays(lastDiscountEndedAt: string | null, now: Date): number {
  if (!lastDiscountEndedAt) return 0;
  const elapsed = daysBetween(now, new Date(lastDiscountEndedAt));
  return Math.max(0, DISCOUNT_COOLDOWN_DAYS - elapsed);
}

/** Days remaining on the 30-day lockout after a base-price increase. 0 if clear. */
export function priceIncreaseLockoutRemainingDays(lastPriceIncreaseAt: string | null, now: Date): number {
  if (!lastPriceIncreaseAt) return 0;
  const elapsed = daysBetween(now, new Date(lastPriceIncreaseAt));
  return Math.max(0, PRICE_INCREASE_LOCKOUT_DAYS - elapsed);
}

export function ageInDays(releaseDate: string, now: Date): number {
  return daysBetween(now, new Date(releaseDate));
}

/**
 * Recommended discount depth, escalating with each prior discount per Steam's
 * "start shallow, deepen over time" guidance. Clamped to a sane ceiling.
 */
export function escalatedDepthPct(priorDiscountCount: number): number {
  const ladder = [20, 25, 33, 40, 50];
  const idx = Math.min(priorDiscountCount, ladder.length - 1);
  return ladder[idx];
}

/**
 * Whether the value-erosion guardrail trips: discounting too often or too deep too
 * early trains buyers to wait and erodes perceived value.
 */
export function valueErosionRisk(priorDiscountCount: number, ageDays: number): boolean {
  if (ageDays <= 0) return false;
  const discountsPerYear = priorDiscountCount / (ageDays / 365);
  return discountsPerYear > 4;
}
