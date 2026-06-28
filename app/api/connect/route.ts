import { NextRequest, NextResponse } from "next/server";
import { listPartnerApps } from "@/lib/steam/partnerClient";
import { PartnerAuthError, PartnerApiError } from "@/lib/steam/partnerApiClient";

/**
 * POST /api/connect  { webApiKey }
 * Validates a Steamworks publisher/financial key by calling
 * GetPartnerAppListForWebAPIKey and returns the appids it can access.
 *
 * The key is handled server-side only and is NEVER echoed, logged, or returned.
 * Single-tenant deployments set the key via env (STEAMWORKS_PARTNER_KEY); this route is
 * for validating a key before saving it. Encrypted persistence lands in Phase 4.
 */
export async function POST(req: NextRequest) {
  let body: { webApiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const webApiKey = (body.webApiKey ?? "").trim();
  if (webApiKey.length < 16) {
    return NextResponse.json({ error: "Invalid Steamworks Web API key" }, { status: 400 });
  }

  try {
    const apps = await listPartnerApps(webApiKey);
    return NextResponse.json({
      ok: true,
      connected: true,
      accessibleAppids: apps.map((a) => a.appid),
      appCount: apps.length,
    });
  } catch (err) {
    if (err instanceof PartnerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PartnerApiError) {
      return NextResponse.json(
        { error: `Steamworks partner API error (HTTP ${err.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Failed to validate key" }, { status: 502 });
  }
}
