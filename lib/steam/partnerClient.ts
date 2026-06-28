import { cached } from "./cache";

/**
 * Steamworks partner Web API — the owner's PRIVATE data (wishlists, sales, revenue).
 * Requires the publisher's own Web API key, which is highly sensitive:
 *   - only ever used server-side (this module is never imported by client components)
 *   - never logged, never returned to the browser
 *   - stored encrypted at rest (see prisma PartnerCredential + lib/crypto on the droplet)
 *
 * NOTE: exact partner endpoints/shapes depend on the publisher's granted scopes and are
 * documented behind the Steamworks partner login. This client is intentionally a thin,
 * well-typed seam so Phase 3 can wire real endpoints without changing call sites. Until a
 * real key is connected it returns null (callers treat private data as optional).
 */

const TTL_MS = 60 * 60 * 1000;

export interface PartnerStats {
  appid: number;
  /** Lifetime / current wishlist count. */
  wishlistCount: number | null;
  /** Units sold in the trailing window, if available. */
  unitsTrailing30d: number | null;
  /** Net revenue (cents) in the trailing window, if available. */
  revenueTrailing30dCents: number | null;
}

export interface PartnerCredentials {
  /** Steamworks publisher Web API key. Server-side only. */
  webApiKey: string;
  /** Publisher group / partner id, if the endpoint requires it. */
  partnerId?: string;
}

/**
 * Fetch the owner's private stats for a game. Returns null when no credentials are
 * connected so the recommendation engine simply runs on public data.
 */
export async function fetchPartnerStats(
  appid: number,
  creds: PartnerCredentials | null,
): Promise<PartnerStats | null> {
  if (!creds?.webApiKey) return null;

  // Cache by appid only — never include the key in the cache key.
  return cached(`partner:${appid}`, TTL_MS, async () => {
    // Phase 3: call the real Steamworks partner endpoints here, e.g.
    //   ISteamApps / wishlist + sales reporting, authenticated with creds.webApiKey.
    // Deliberately not implemented against live endpoints yet.
    throw new PartnerNotImplementedError(appid);
  });
}

export class PartnerNotImplementedError extends Error {
  constructor(appid: number) {
    super(`Partner stats fetch not yet wired for appid ${appid}`);
    this.name = "PartnerNotImplementedError";
  }
}
