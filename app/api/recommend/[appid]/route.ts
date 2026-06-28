import { NextRequest, NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/steam/aggregate";
import { getPartnerStatsForApp } from "@/lib/steam/partnerData";
import { inputFromSnapshot } from "@/lib/recommendation/fromSnapshot";
import { recommend } from "@/lib/recommendation/engine";

/**
 * GET /api/recommend/:appid
 * Builds a snapshot, optionally enriches with the owner's private partner stats, then
 * runs the recommendation engine. Returns { snapshot, recommendation }.
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

    // Partner stats are optional — present only when a key is configured server-side.
    const partner = await getPartnerStatsForApp(appid);

    const recommendation = recommend(inputFromSnapshot(snapshot, partner));
    return NextResponse.json({ snapshot, recommendation, partner });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to compute recommendation", detail: String(err) },
      { status: 502 },
    );
  }
}
