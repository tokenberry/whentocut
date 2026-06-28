import { cached } from "./cache";
import { GameCore } from "./types";

/**
 * Steam Store storefront API (public, undocumented but stable):
 *   https://store.steampowered.com/api/appdetails?appids=<id>&cc=us&l=en
 * Gives name, release date, genres, and current price/discount in one call.
 */

const APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";
const TTL_MS = 30 * 60 * 1000; // prices change slowly; 30 min is plenty

interface AppDetailsPrice {
  currency: string;
  initial: number; // cents
  final: number; // cents (after discount)
  discount_percent: number;
}

interface AppDetailsData {
  name: string;
  is_free: boolean;
  genres?: { id: string; description: string }[];
  price_overview?: AppDetailsPrice;
  release_date?: { coming_soon: boolean; date: string };
  header_image?: string;
}

interface AppDetailsResponse {
  [appid: string]: { success: boolean; data?: AppDetailsData };
}

function parseReleaseDate(raw?: { coming_soon: boolean; date: string }): string | null {
  if (!raw || raw.coming_soon || !raw.date) return null;
  const t = Date.parse(raw.date); // e.g. "25 Jun, 2024"
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export async function fetchGameCore(
  appid: number,
  cc = "us",
): Promise<GameCore | null> {
  return cached(`store:${appid}:${cc}`, TTL_MS, async () => {
    const url = `${APPDETAILS_URL}?appids=${appid}&cc=${cc}&l=en`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error(`Steam Store appdetails ${appid} -> HTTP ${res.status}`);
    const json = (await res.json()) as AppDetailsResponse;
    const entry = json[String(appid)];
    if (!entry?.success || !entry.data) return null;

    const d = entry.data;
    const price = d.price_overview;
    return {
      appid,
      name: d.name,
      releaseDate: parseReleaseDate(d.release_date),
      currentPriceCents: price ? price.final : d.is_free ? 0 : null,
      basePriceCents: price ? price.initial : d.is_free ? 0 : null,
      currentDiscountPct: price ? price.discount_percent : 0,
      currency: price ? price.currency : null,
      isFree: d.is_free,
      genres: (d.genres ?? []).map((g) => g.description),
      headerImage: d.header_image ?? null,
    };
  });
}
