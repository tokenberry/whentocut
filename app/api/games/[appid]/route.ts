import { NextRequest, NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/steam/aggregate";

/**
 * GET /api/games/:appid
 * Server-side aggregate of public Steam data (store + SteamSpy + live players + rivals).
 * Runs server-side so we control caching/rate limits and never expose keys to the client.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appid: string }> },
) {
  const { appid: raw } = await params;
  const appid = Number(raw);
  if (!Number.isInteger(appid) || appid <= 0) {
    return NextResponse.json({ error: "Invalid appid" }, { status: 400 });
  }

  try {
    const snapshot = await buildSnapshot(appid);
    if (!snapshot) {
      return NextResponse.json(
        { error: `No Steam app found for appid ${appid}` },
        { status: 404 },
      );
    }
    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch Steam data", detail: String(err) },
      { status: 502 },
    );
  }
}
