import { NextRequest, NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/steam/aggregate";
import { fetchPartnerStats, PartnerNotImplementedError } from "@/lib/steam/partnerClient";
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

    // Partner stats are optional — only present once the owner connects a key (Phase 3).
    let partner = null;
    try {
      partner = await fetchPartnerStats(appid, null);
    } catch (e) {
      if (!(e instanceof PartnerNotImplementedError)) throw e;
    }

    const recommendation = recommend(inputFromSnapshot(snapshot, partner));
    return NextResponse.json({ snapshot, recommendation });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to compute recommendation", detail: String(err) },
      { status: 502 },
    );
  }
}
