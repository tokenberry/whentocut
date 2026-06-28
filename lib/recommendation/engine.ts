import {
  RecommendationInput,
  Recommendation,
  RecommendationAction,
} from "./types";
import {
  cooldownRemainingDays,
  priceIncreaseLockoutRemainingDays,
  ageInDays,
  escalatedDepthPct,
  valueErosionRisk,
  addDays,
  toISODate,
  MIN_AGE_BEFORE_DISCOUNT_DAYS,
  VALVE_REVIEW_LEAD_DAYS,
} from "./rules";
import {
  activeSale,
  nextSeasonalSale,
  daysUntil,
  SteamSale,
} from "../salesCalendar";

/**
 * The core advisor. A pure function: given a game's pricing/market state, returns a
 * timed, sized discount recommendation with explicit reasons. No I/O — fully testable.
 *
 * Decision order:
 *  1. Hard Steam constraints (cooldown, price-increase lockout) can BLOCK.
 *  2. Game must be old enough to discount (skip the early full-price window).
 *  3. If a seasonal sale is live or imminent, recommend discounting into it.
 *  4. Otherwise, if demand signals are weak, steer toward the next seasonal sale.
 *  5. Else hold. The value-erosion guardrail can downgrade an otherwise-positive call.
 */
export function recommend(
  input: RecommendationInput,
  sales?: SteamSale[],
): Recommendation {
  const reasons: string[] = [];
  const { now } = input;

  // Already on sale — nothing to schedule.
  if (input.currentDiscountPct > 0) {
    return {
      action: "hold",
      suggestedDiscountPct: null,
      window: null,
      actByDate: null,
      confidence: 0.9,
      reasons: [
        `Game is already discounted ${input.currentDiscountPct}% — let the current sale run its course.`,
      ],
    };
  }

  // 1. Hard Steam constraints.
  const cooldown = cooldownRemainingDays(input.lastDiscountEndedAt, now);
  const lockout = priceIncreaseLockoutRemainingDays(input.lastPriceIncreaseAt, now);
  if (cooldown > 0 || lockout > 0) {
    if (cooldown > 0) {
      reasons.push(
        `Steam's 30-day discount cooldown is active — ${cooldown} day(s) remaining before a new discount is allowed.`,
      );
    }
    if (lockout > 0) {
      reasons.push(
        `A recent base-price increase locks out discounts for ${lockout} more day(s).`,
      );
    }
    return blocked(reasons, now, Math.max(cooldown, lockout));
  }

  // 2. Age gate — don't erode launch-window full-price sales.
  const age = ageInDays(input.releaseDate, now);
  if (age < MIN_AGE_BEFORE_DISCOUNT_DAYS) {
    reasons.push(
      `Only ${age} day(s) since release — hold full price through the launch window (first ~${MIN_AGE_BEFORE_DISCOUNT_DAYS} days) to protect perceived value.`,
    );
    const next = nextSeasonalSale(now, sales);
    if (next) {
      reasons.push(
        `Plan the first discount for ${next.name} (${next.start}).`,
      );
    }
    return {
      action: "hold",
      suggestedDiscountPct: null,
      window: null,
      actByDate: null,
      confidence: 0.8,
      reasons,
    };
  }

  const depth = escalatedDepthPct(input.priorDiscountCount);
  const erosion = valueErosionRisk(input.priorDiscountCount, age);

  // 3. Seasonal sale live or imminent → discount into it (cooldown-exempt, max visibility).
  const live = activeSale(now, sales);
  const next = nextSeasonalSale(now, sales);
  const daysToNext = next ? daysUntil(next.start, now) : Infinity;

  if (live && live.kind === "seasonal") {
    reasons.push(
      `${live.name} is live now (through ${live.end}) — the highest-visibility window and exempt from the 30-day cooldown.`,
    );
    reasons.push(depthReason(input.priorDiscountCount, depth));
    pushDemandReasons(input, reasons);
    const rec: Recommendation = {
      action: "discount_now",
      suggestedDiscountPct: depth,
      window: { label: live.name, start: live.start, end: live.end },
      actByDate: toISODate(now),
      confidence: 0.85,
      reasons,
    };
    return applyErosionGuard(rec, erosion);
  }

  if (next && daysToNext <= VALVE_REVIEW_LEAD_DAYS + 7) {
    reasons.push(
      `${next.name} starts in ${daysToNext} day(s) (${next.start}) — schedule now to clear Valve review (≈${VALVE_REVIEW_LEAD_DAYS} days lead).`,
    );
    reasons.push(depthReason(input.priorDiscountCount, depth));
    pushDemandReasons(input, reasons);
    const rec: Recommendation = {
      action: "discount_now",
      suggestedDiscountPct: depth,
      window: { label: next.name, start: next.start, end: next.end },
      actByDate: toISODate(addDays(new Date(`${next.start}T00:00:00Z`), -VALVE_REVIEW_LEAD_DAYS)),
      confidence: 0.85,
      reasons,
    };
    return applyErosionGuard(rec, erosion);
  }

  // 4. Off-season: weak demand can justify steering toward the next seasonal sale.
  const weakDemand =
    (input.playerTrend !== null && input.playerTrend <= -0.25) ||
    (input.rivalsOnSaleFraction !== null && input.rivalsOnSaleFraction >= 0.5);

  if (weakDemand && next && next.kind === "seasonal") {
    pushDemandReasons(input, reasons);
    reasons.push(
      `Best to wait for ${next.name} (${next.start}, in ${daysToNext} days) rather than burn a low-visibility off-season discount.`,
    );
    reasons.push(depthReason(input.priorDiscountCount, depth));
    const rec: Recommendation = {
      action: "schedule_for_sale",
      suggestedDiscountPct: depth,
      window: { label: next.name, start: next.start, end: next.end },
      actByDate: toISODate(addDays(new Date(`${next.start}T00:00:00Z`), -VALVE_REVIEW_LEAD_DAYS)),
      confidence: 0.7,
      reasons,
    };
    return applyErosionGuard(rec, erosion);
  }

  // 5. Hold.
  reasons.push(
    "No seasonal sale is imminent and demand signals are stable — hold full price to protect value.",
  );
  if (next) {
    reasons.push(`Next opportunity: ${next.name} (${next.start}).`);
  }
  pushDemandReasons(input, reasons);
  return {
    action: "hold",
    suggestedDiscountPct: null,
    window: null,
    actByDate: null,
    confidence: 0.65,
    reasons,
  };
}

function blocked(reasons: string[], now: Date, remainingDays: number): Recommendation {
  return {
    action: "blocked",
    suggestedDiscountPct: null,
    window: null,
    actByDate: toISODate(addDays(now, remainingDays)),
    confidence: 0.95,
    reasons,
  };
}

function depthReason(priorCount: number, depth: number): string {
  if (priorCount === 0) {
    return `Suggested depth: ${depth}% — start shallow on the first discount and deepen over future sales.`;
  }
  return `Suggested depth: ${depth}% — escalated from ${priorCount} prior discount(s) per "deepen over time" guidance.`;
}

function pushDemandReasons(input: RecommendationInput, reasons: string[]): void {
  if (input.playerTrend !== null) {
    const pct = Math.round(input.playerTrend * 100);
    if (pct <= -10) reasons.push(`Player count is down ${Math.abs(pct)}% — a discount can re-spark attention.`);
    else if (pct >= 10) reasons.push(`Player count is up ${pct}% — momentum is healthy.`);
  }
  if (input.rivalsOnSaleFraction !== null && input.rivalsOnSaleFraction >= 0.5) {
    reasons.push(
      `${Math.round(input.rivalsOnSaleFraction * 100)}% of tracked rivals are on sale — matching keeps you competitive.`,
    );
  }
  if (input.wishlistCount !== null && input.wishlistCount > 0) {
    reasons.push(
      `${input.wishlistCount.toLocaleString()} wishlisters will get a notification when the discount goes live.`,
    );
  }
  if (input.recentWishlistAdds !== null) {
    if (input.recentWishlistAdds > 0) {
      reasons.push(
        `+${input.recentWishlistAdds.toLocaleString()} net wishlist adds in the last 30 days — fresh demand to convert with a discount.`,
      );
    } else if (input.recentWishlistAdds < 0) {
      reasons.push(
        `Net wishlist additions are negative over the last 30 days — interest is cooling; a discount can re-engage.`,
      );
    }
  }
}

function applyErosionGuard(rec: Recommendation, erosion: boolean): Recommendation {
  if (!erosion) return rec;
  return {
    ...rec,
    confidence: Math.max(0.4, rec.confidence - 0.25),
    reasons: [
      ...rec.reasons,
      "⚠️ Value-erosion guardrail: you've discounted frequently relative to the game's age (>4×/yr). Consider a shallower cut or skipping this window to avoid training buyers to wait.",
    ],
  };
}

export type { Recommendation, RecommendationInput, RecommendationAction };
