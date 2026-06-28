import { GameSnapshot } from "../steam/types";
import { rivalsOnSaleFraction } from "../steam/aggregate";
import { PartnerStats } from "../steam/partnerClient";
import { RecommendationInput } from "./types";

/**
 * Map a public GameSnapshot (+ optional private partner stats) into engine input.
 *
 * MVP limitation: fields that need historical tracking — lastDiscountEndedAt,
 * lastPriceIncreaseAt, playerTrend, priorDiscountCount — require stored snapshots
 * (Phase 4 persistence). Until then they default to "unknown/clear" so the engine
 * runs on current state. Once snapshots are persisted, fill these from history.
 */
export function inputFromSnapshot(
  snap: GameSnapshot,
  partner: PartnerStats | null,
  now: Date = new Date(),
): RecommendationInput {
  const { core } = snap;
  return {
    currentPriceCents: core.currentPriceCents ?? 0,
    basePriceCents: core.basePriceCents ?? 0,
    currentDiscountPct: core.currentDiscountPct,
    releaseDate: core.releaseDate ?? now.toISOString().slice(0, 10),
    lastDiscountEndedAt: null,
    lastPriceIncreaseAt: null,
    priorDiscountCount: 0,
    playerTrend: null,
    rivalsOnSaleFraction: rivalsOnSaleFraction(snap.rivals),
    wishlistCount: partner?.wishlistCount ?? null,
    now,
  };
}
