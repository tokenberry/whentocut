import { fetchPartnerStats, PartnerStats } from "./partnerClient";
import { resolvePartnerCreds } from "./partnerCreds";
import { PartnerApiError } from "./partnerApiClient";

/**
 * Resolve credentials (the user's own key, or the env fallback) and fetch the owner's
 * private stats for an app, degrading to null on any partner-API error (private data is
 * always optional — the engine runs on public data alone).
 */
export async function getPartnerStatsForApp(
  appid: number,
  userId?: string | null,
  now?: Date,
): Promise<PartnerStats | null> {
  const creds = await resolvePartnerCreds(userId);
  if (!creds) return null;
  try {
    return await fetchPartnerStats(appid, creds, now);
  } catch (e) {
    if (e instanceof PartnerApiError) return null; // bad key / permission / outage
    throw e;
  }
}
