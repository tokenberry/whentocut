import { cached } from "./cache";
import {
  partnerGet,
  toPacificDate,
  toGmtDate,
  parseMoneyToCents,
  mapWithConcurrency,
} from "./partnerApiClient";

/** How many partner calls to run at once when fetching trailing windows. */
const FETCH_CONCURRENCY = 6;

/**
 * Steamworks PARTNER Web API — the owner's PRIVATE data (sales, revenue, wishlists).
 * Thin endpoint wrappers + an aggregator the recommendation pipeline consumes.
 *
 * Endpoints (host partner.steam-api.com, key as ?key=, server-side only):
 *   ISteamApps/GetPartnerAppListForWebAPIKey/v2          — validate key + accessible apps
 *   IPartnerFinancialsService/GetDetailedSales/v001       — sales for a date (Pacific TZ)
 *   IPartnerFinancialsService/GetAppWishlistReporting/v001— wishlist deltas for a date (GMT)
 *   IPartnerFinancialsService/GetChangedDatesForPartner/v001 — dates with changes
 */

export interface PartnerCredentials {
  /** Steamworks publisher or financial Web API key. Server-side only. */
  webApiKey: string;
}

export interface PartnerStats {
  appid: number;
  connected: boolean;
  /** Units sold in the trailing window. */
  unitsTrailing30d: number | null;
  /** Net revenue (USD cents) in the trailing window. */
  revenueTrailing30dCents: number | null;
  /** Net wishlist adds (adds − deletes − purchases) over the trailing window. */
  wishlistAdds30d: number | null;
  /** True outstanding wishlist total — reserved for Phase 4 full-history accumulation. */
  wishlistCount: number | null;
}

const STATS_TTL_MS = 60 * 60 * 1000;
const TRAILING_DAYS = 30;

// ---- endpoint wrappers -----------------------------------------------------

interface PartnerAppListResponse {
  applist?: { apps?: { appid: number; name?: string }[] };
  apps?: { appid: number; name?: string }[];
}

/** Validate a key and return the appids it can access. Used by /api/connect. */
export async function listPartnerApps(
  key: string,
): Promise<{ appid: number; name: string | null }[]> {
  const json = await partnerGet<PartnerAppListResponse>(
    "ISteamApps/GetPartnerAppListForWebAPIKey/v2",
    key,
  );
  const apps = json.applist?.apps ?? json.apps ?? [];
  return apps.map((a) => ({ appid: a.appid, name: a.name ?? null }));
}

interface DetailedSalesLine {
  date: string;
  line_item_type?: string;
  primary_appid?: number;
  net_sales_usd?: string;
  gross_sales_usd?: string;
  net_units_sold?: number | string;
  gross_units_sold?: number | string;
}

interface DetailedSalesResponse {
  response?: { results?: DetailedSalesLine[]; max_id?: string };
}

/** All sales line items for one Pacific-time date, following `max_id` pagination. */
export async function fetchDetailedSales(
  key: string,
  date: string,
): Promise<DetailedSalesLine[]> {
  const out: DetailedSalesLine[] = [];
  let highwatermark = 0;
  // Guard against unbounded loops; a single day rarely needs many pages.
  for (let page = 0; page < 50; page++) {
    const json = await partnerGet<DetailedSalesResponse>(
      "IPartnerFinancialsService/GetDetailedSales/v001",
      key,
      { date, highwatermark_id: highwatermark },
    );
    const results = json.response?.results ?? [];
    out.push(...results);
    const maxId = Number(json.response?.max_id ?? 0);
    if (!results.length || !maxId || maxId <= highwatermark) break;
    highwatermark = maxId;
  }
  return out;
}

interface WishlistReportResponse {
  response?: {
    appid?: number;
    date?: string;
    wishlist_summary?: {
      wishlist_adds?: number;
      wishlist_deletes?: number;
      wishlist_purchases?: number;
    };
    app_min_date?: string;
  };
}

export interface WishlistDay {
  date: string;
  adds: number;
  deletes: number;
  purchases: number;
}

/** Wishlist deltas for one app on one GMT date. */
export async function fetchWishlistReport(
  key: string,
  appid: number,
  date: string,
): Promise<WishlistDay> {
  const json = await partnerGet<WishlistReportResponse>(
    "IPartnerFinancialsService/GetAppWishlistReporting/v001",
    key,
    { appid, date },
  );
  const s = json.response?.wishlist_summary ?? {};
  return {
    date,
    adds: s.wishlist_adds ?? 0,
    deletes: s.wishlist_deletes ?? 0,
    purchases: s.wishlist_purchases ?? 0,
  };
}

// ---- aggregation -----------------------------------------------------------

function lastNDates(now: Date, n: number, fmt: (d: Date) => string): string[] {
  const dates: string[] = [];
  // Start at yesterday — today's data isn't available yet.
  for (let i = 1; i <= n; i++) {
    dates.push(fmt(new Date(now.getTime() - i * 86_400_000)));
  }
  return dates;
}

function unitsOf(line: DetailedSalesLine): number {
  const n = Number(line.net_units_sold ?? line.gross_units_sold ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Trailing-window private stats for one app. Returns null when no key is connected so
 * the recommendation engine simply runs on public data. Cached by appid only — the key
 * is never part of the cache key.
 */
export async function fetchPartnerStats(
  appid: number,
  creds: PartnerCredentials | null,
  now: Date = new Date(),
): Promise<PartnerStats | null> {
  if (!creds?.webApiKey) return null;
  const key = creds.webApiKey;

  return cached(`partner:stats:${appid}`, STATS_TTL_MS, async () => {
    // Sales — trailing Pacific-time dates, sum this app's net revenue + units.
    const salesDates = lastNDates(now, TRAILING_DAYS, toPacificDate);
    const salesByDate = await mapWithConcurrency(salesDates, FETCH_CONCURRENCY, (date) =>
      fetchDetailedSales(key, date),
    );
    let revenueCents = 0;
    let units = 0;
    for (const lines of salesByDate) {
      for (const line of lines) {
        if (line.primary_appid !== appid) continue;
        revenueCents += parseMoneyToCents(line.net_sales_usd);
        units += unitsOf(line);
      }
    }

    // Wishlists — trailing GMT dates, sum net adds.
    const wishlistDates = lastNDates(now, TRAILING_DAYS, toGmtDate);
    const wishlistDays = await mapWithConcurrency(wishlistDates, FETCH_CONCURRENCY, (date) =>
      fetchWishlistReport(key, appid, date),
    );
    const wishlistNet = wishlistDays.reduce(
      (sum, d) => sum + d.adds - d.deletes - d.purchases,
      0,
    );

    return {
      appid,
      connected: true,
      unitsTrailing30d: units,
      revenueTrailing30dCents: revenueCents,
      wishlistAdds30d: wishlistNet,
      wishlistCount: null,
    };
  });
}
