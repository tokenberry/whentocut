import { PartnerCredentials } from "./partnerClient";

/**
 * Resolve partner credentials for an app. Single-tenant for now: the publisher's own
 * key comes from the server environment (STEAMWORKS_PARTNER_KEY, or a dedicated
 * STEAMWORKS_FINANCIAL_KEY). This is the one seam Phase 4 swaps for a per-app, encrypted
 * PartnerCredential store without touching callers.
 *
 * Returns null when no key is configured so the app degrades to public-only data.
 * Server-side only — never import from a client component.
 */
export function resolvePartnerCreds(_appid: number): PartnerCredentials | null {
  const webApiKey =
    process.env.STEAMWORKS_FINANCIAL_KEY?.trim() ||
    process.env.STEAMWORKS_PARTNER_KEY?.trim();
  if (!webApiKey) return null;
  return { webApiKey };
}

/** Whether any partner key is configured at all. */
export function partnerConfigured(): boolean {
  return Boolean(
    process.env.STEAMWORKS_FINANCIAL_KEY?.trim() ||
      process.env.STEAMWORKS_PARTNER_KEY?.trim(),
  );
}
