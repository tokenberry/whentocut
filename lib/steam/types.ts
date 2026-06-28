/** Normalized shapes the rest of the app consumes, independent of source quirks. */

export interface GameCore {
  appid: number;
  name: string;
  releaseDate: string | null; // ISO date or null if unreleased/unknown
  /** Current store price in minor units (cents), or null if free/unknown. */
  currentPriceCents: number | null;
  /** Base (undiscounted) price in minor units (cents), or null. */
  basePriceCents: number | null;
  /** Live discount percent on the store (0 if none). */
  currentDiscountPct: number;
  currency: string | null;
  isFree: boolean;
  genres: string[];
  headerImage: string | null;
}

export interface GameMarketStats {
  appid: number;
  /** SteamSpy estimated owners range as a label, e.g. "200,000 .. 500,000". */
  ownersRange: string | null;
  positiveReviews: number | null;
  negativeReviews: number | null;
  /** SteamSpy-reported tags (name -> vote weight), highest first. */
  topTags: string[];
  /** Live concurrent players from the Steam Web API, or null. */
  currentPlayers: number | null;
  /** SteamSpy average concurrent users (ccu), or null. */
  averageCcu: number | null;
}

export interface Rival extends GameCore {
  /** Live discount > 0 means this rival is currently on sale. */
  onSale: boolean;
}

export interface GameSnapshot {
  core: GameCore;
  stats: GameMarketStats;
  rivals: Rival[];
  capturedAt: string; // ISO
}
