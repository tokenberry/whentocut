import { cached, steamSpyLimiter } from "./cache";
import { GameMarketStats } from "./types";

/**
 * SteamSpy API (https://steamspy.com/api.php). Free, refreshed daily, max ~1 req/sec.
 * Source of estimated owners, review counts, tags, and average CCU. Tags drive rival
 * discovery. All calls go through the shared SteamSpy rate limiter.
 */

const STEAMSPY_URL = "https://steamspy.com/api.php";
const TTL_MS = 12 * 60 * 60 * 1000; // SteamSpy refreshes ~daily

interface SteamSpyApp {
  appid: number;
  name: string;
  owners?: string; // "200,000 .. 500,000"
  positive?: number;
  negative?: number;
  ccu?: number;
  tags?: Record<string, number> | unknown[];
}

async function steamSpyGet<T>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  return steamSpyLimiter.run(async () => {
    const res = await fetch(`${STEAMSPY_URL}?${qs}`);
    if (!res.ok) throw new Error(`SteamSpy ${qs} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  });
}

function topTagsOf(app: SteamSpyApp): string[] {
  const tags = app.tags;
  if (!tags || Array.isArray(tags)) return [];
  return Object.entries(tags as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
}

export async function fetchMarketStats(appid: number): Promise<GameMarketStats> {
  return cached(`steamspy:appdetails:${appid}`, TTL_MS, async () => {
    const app = await steamSpyGet<SteamSpyApp>({ request: "appdetails", appid: String(appid) });
    return {
      appid,
      ownersRange: app.owners ?? null,
      positiveReviews: app.positive ?? null,
      negativeReviews: app.negative ?? null,
      topTags: topTagsOf(app),
      currentPlayers: null, // filled by webApiClient
      averageCcu: app.ccu ?? null,
    };
  });
}

/**
 * Find candidate rival appids that share a tag, using SteamSpy's tag query.
 * Returns up to `limit` appids excluding the source game.
 */
export async function fetchRivalAppids(
  tag: string,
  excludeAppid: number,
  limit = 8,
): Promise<number[]> {
  return cached(`steamspy:tag:${tag}`, TTL_MS, async () => {
    const apps = await steamSpyGet<Record<string, SteamSpyApp>>({
      request: "tag",
      tag,
    });
    return Object.values(apps)
      .map((a) => a.appid)
      .filter((id) => id && id !== excludeAppid);
  }).then((ids) => ids.slice(0, limit));
}
