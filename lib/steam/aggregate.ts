import { fetchGameCore } from "./storeClient";
import { fetchMarketStats, fetchRivalAppids } from "./steamSpyClient";
import { fetchCurrentPlayers } from "./webApiClient";
import { GameSnapshot, Rival } from "./types";

/**
 * Assemble a full GameSnapshot from the public sources: core store data + SteamSpy
 * market stats + live players, plus a set of rivals discovered via the game's top tag.
 * Rival core data is fetched in parallel; failures for individual rivals are tolerated.
 */
export async function buildSnapshot(appid: number): Promise<GameSnapshot | null> {
  const core = await fetchGameCore(appid);
  if (!core) return null;

  const [stats, players] = await Promise.all([
    fetchMarketStats(appid),
    fetchCurrentPlayers(appid).catch(() => null),
  ]);
  stats.currentPlayers = players;

  const rivals = await buildRivals(appid, stats.topTags, core.genres);

  return {
    core,
    stats,
    rivals,
    capturedAt: new Date().toISOString(),
  };
}

async function buildRivals(
  appid: number,
  topTags: string[],
  genres: string[],
): Promise<Rival[]> {
  const tag = topTags[0] ?? genres[0];
  if (!tag) return [];

  let candidateIds: number[] = [];
  try {
    candidateIds = await fetchRivalAppids(tag, appid, 8);
  } catch {
    return [];
  }

  const cores = await Promise.all(
    candidateIds.map((id) => fetchGameCore(id).catch(() => null)),
  );

  return cores
    .filter((c): c is NonNullable<typeof c> => c !== null && !c.isFree)
    .slice(0, 6)
    .map((c) => ({ ...c, onSale: c.currentDiscountPct > 0 }));
}

/** Fraction of rivals currently on sale, or null if there are no rivals. */
export function rivalsOnSaleFraction(rivals: Rival[]): number | null {
  if (rivals.length === 0) return null;
  return rivals.filter((r) => r.onSale).length / rivals.length;
}
