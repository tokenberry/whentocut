/** Inputs and outputs for the discount recommendation engine. */

export type RecommendationAction =
  | "discount_now" // a sale is live or imminent — schedule/run a discount now
  | "schedule_for_sale" // hold and align the next discount to an upcoming seasonal sale
  | "hold" // no discount warranted right now
  | "blocked"; // Steam rules currently forbid a discount (cooldown / price-increase lockout)

export interface RecommendationInput {
  /** Current store price in minor units (cents). */
  currentPriceCents: number;
  /** Base (undiscounted) price in minor units (cents). */
  basePriceCents: number;
  /** Current live discount percent on the store (0 if none). */
  currentDiscountPct: number;
  /** Game release date (ISO). */
  releaseDate: string;
  /** When the last discount ENDED (ISO), or null if never discounted. Drives cooldown. */
  lastDiscountEndedAt: string | null;
  /** When the base price was last INCREASED (ISO), or null. Triggers a 30-day lockout. */
  lastPriceIncreaseAt: string | null;
  /** Number of prior discounts run — drives depth escalation. */
  priorDiscountCount: number;
  /** Recent player-count trend as a fraction, e.g. -0.30 = down 30% vs the prior window. */
  playerTrend: number | null;
  /** Fraction of tracked rivals currently on sale (0..1), or null if unknown. */
  rivalsOnSaleFraction: number | null;
  /** Owner's outstanding wishlist total (from partner API), or null if unknown. */
  wishlistCount: number | null;
  /** Net wishlist adds over the trailing window (partner API), or null. A demand signal. */
  recentWishlistAdds: number | null;
  /** Evaluation time. */
  now: Date;
}

export interface Recommendation {
  action: RecommendationAction;
  /** Suggested discount depth as a percent (e.g. 25). Null when action is hold/blocked. */
  suggestedDiscountPct: number | null;
  /** Human-friendly target window for the discount, or null. */
  window: { label: string; start: string; end: string } | null;
  /** Date by which the owner should act in Steamworks (accounts for Valve review lead time). */
  actByDate: string | null;
  /** 0..1 confidence in the recommendation. */
  confidence: number;
  /** Ordered, human-readable explanations for the recommendation. */
  reasons: string[];
}
