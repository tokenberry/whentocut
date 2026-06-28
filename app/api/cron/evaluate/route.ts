import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/cron/evaluate
 * Periodic re-evaluation entrypoint. On the droplet, a system cron (or node-cron in the
 * always-on process) hits this to: capture snapshots for all TrackedGames, recompute
 * recommendations, and fire alerts via lib/alerts/notify when shouldAlert() is true.
 *
 * Protected by a shared secret so it can't be triggered externally.
 * Phase 4 implements the body against Prisma + alert delivery.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO(phase 4):
  //   1. const games = await prisma.trackedGame.findMany()
  //   2. for each: buildSnapshot -> persist Snapshot (+ archive JSON to DO Spaces)
  //   3. recompute recommendation from snapshot history
  //   4. if shouldAlert(rec): sendAlert to each AlertSubscription, set lastFiredAt
  return NextResponse.json({ ok: true, evaluated: 0, note: "Evaluator stub (Phase 4)." });
}
