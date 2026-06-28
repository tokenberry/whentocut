/**
 * Low-level client for the Steamworks PARTNER Web API (partner.steam-api.com).
 *
 * The publisher/financial key is passed as ?key= and is highly sensitive:
 *   - server-side only (this module must never be imported by a client component)
 *   - never logged, never echoed to the browser, never placed in a cache key
 *   - redacted from any error message (see redactKey)
 */

const PARTNER_HOST = "https://partner.steam-api.com";

export class PartnerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
  ) {
    super(message);
    this.name = "PartnerApiError";
  }
}

/** 401/403 — bad key or missing "Sales Data" permission. */
export class PartnerAuthError extends PartnerApiError {
  constructor(status: number, endpoint: string) {
    super(
      status,
      endpoint,
      `Steamworks partner API rejected the key (HTTP ${status}). Check the key and that it has the "Sales Data" permission.`,
    );
    this.name = "PartnerAuthError";
  }
}

/** Strip a key value if it ever appears in a string (defense in depth for logs/errors). */
export function redactKey(text: string, key: string): string {
  if (!key) return text;
  return text.split(key).join("[REDACTED]");
}

/**
 * GET a partner endpoint. `path` is the interface/method/version, e.g.
 * "IPartnerFinancialsService/GetDetailedSales/v001". `params` are added to the query;
 * the key is attached here so callers never build URLs containing it.
 */
export async function partnerGet<T>(
  path: string,
  key: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${PARTNER_HOST}/${path}/`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("key", key);

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (e) {
    // Never let a network error leak the URL (which contains the key).
    throw new PartnerApiError(0, path, redactKey(`Network error calling ${path}: ${e}`, key));
  }
  if (res.status === 401 || res.status === 403) {
    throw new PartnerAuthError(res.status, path);
  }
  if (!res.ok) {
    throw new PartnerApiError(res.status, path, `Partner API ${path} -> HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Map over items with bounded concurrency, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---- formatting / parsing helpers -----------------------------------------

/** YYYY-MM-DD for a given date in a given IANA timezone. */
function dateInZone(d: Date, timeZone: string): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** GetDetailedSales dates are interpreted as US Pacific time. */
export function toPacificDate(d: Date): string {
  return dateInZone(d, "America/Los_Angeles");
}

/** GetAppWishlistReporting dates are interpreted as GMT/UTC. */
export function toGmtDate(d: Date): string {
  return dateInZone(d, "UTC");
}

/** GetChangedDatesForPartner returns YYYY/MM/DD with slashes; normalize to dashes. */
export function normalizeSlashDate(date: string): string {
  return date.replace(/\//g, "-");
}

/** Partner financial values are decimal-string USD amounts; convert to integer cents. */
export function parseMoneyToCents(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** The most recent date with data for daily-delta endpoints is "yesterday". */
export function yesterday(now: Date, timeZone: "UTC" | "America/Los_Angeles" = "UTC"): string {
  return timeZone === "UTC"
    ? toGmtDate(new Date(now.getTime() - 86_400_000))
    : toPacificDate(new Date(now.getTime() - 86_400_000));
}
