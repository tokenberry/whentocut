import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/connect  { appid, webApiKey, partnerId? }
 * Accepts a Steamworks partner Web API key for an app and (Phase 4) persists it
 * encrypted in Postgres (PartnerCredential). The key is handled server-side only and
 * is NEVER echoed back, logged, or returned to the client.
 *
 * Phase 3/4 will: validate the key against a partner endpoint, encrypt with a server
 * secret, and upsert PartnerCredential. For now it validates shape and acknowledges.
 */
export async function POST(req: NextRequest) {
  let body: { appid?: number; webApiKey?: string; partnerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const appid = Number(body.appid);
  const webApiKey = (body.webApiKey ?? "").trim();
  if (!Number.isInteger(appid) || appid <= 0) {
    return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
  }
  if (webApiKey.length < 16) {
    return NextResponse.json({ error: "Invalid Steamworks Web API key" }, { status: 400 });
  }

  // TODO(phase 4): encrypt(webApiKey) -> upsert PartnerCredential(appid).
  return NextResponse.json({
    ok: true,
    appid,
    connected: true,
    note: "Key accepted. Persistence + validation land in a later phase.",
  });
}
