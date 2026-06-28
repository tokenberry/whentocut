import { cached } from "./cache";

/**
 * Official Steam Web API. GetNumberOfCurrentPlayers is public and needs no key.
 * Other endpoints (and the Steamworks partner endpoints) require a key; see
 * partnerClient.ts.
 */

const CURRENT_PLAYERS_URL =
  "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/";
const TTL_MS = 5 * 60 * 1000; // live-ish, but don't hammer

interface CurrentPlayersResponse {
  response?: { player_count?: number; result?: number };
}

export async function fetchCurrentPlayers(appid: number): Promise<number | null> {
  return cached(`players:${appid}`, TTL_MS, async () => {
    const res = await fetch(`${CURRENT_PLAYERS_URL}?appid=${appid}`);
    if (!res.ok) throw new Error(`GetNumberOfCurrentPlayers ${appid} -> HTTP ${res.status}`);
    const json = (await res.json()) as CurrentPlayersResponse;
    if (json.response?.result !== 1) return null;
    return json.response.player_count ?? null;
  });
}
