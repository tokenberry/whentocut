import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildSnapshot } from "@/lib/steam/aggregate";
import { getPartnerStatsForApp } from "@/lib/steam/partnerData";
import { inputFromSnapshot } from "@/lib/recommendation/fromSnapshot";
import { recommend } from "@/lib/recommendation/engine";
import { shouldAlert, alertSignature, formatAlert, formatAlertHtml } from "@/lib/alerts/notify";
import { sendEmail } from "@/lib/email";
import { GameSnapshot } from "@/lib/steam/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/cron/evaluate  (guarded by CRON_SECRET)
 * Re-evaluates every tracked game and emails the owner when the recommendation becomes
 * actionable — but only when it has changed since the last email (alertSignature), so
 * users aren't spammed daily with the same advice.
 *
 * On the droplet a daily cron hits this:
 *   0 9 * * *  curl -fsS -X POST https://whentocut.com/api/cron/evaluate -H "x-cron-secret: $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const games = await prisma.trackedGame.findMany({ include: { user: true } });

  // One snapshot per appid (multiple users may track the same game).
  const snapshots = new Map<number, GameSnapshot | null>();
  let evaluated = 0;
  let sent = 0;
  const errors: string[] = [];

  for (const g of games) {
    evaluated++;
    try {
      if (!snapshots.has(g.appid)) {
        snapshots.set(g.appid, await buildSnapshot(g.appid).catch(() => null));
      }
      const snap = snapshots.get(g.appid);
      if (!snap) continue;

      const partner = await getPartnerStatsForApp(g.appid, g.userId);
      const rec = recommend(inputFromSnapshot(snap, partner));

      if (!shouldAlert(rec)) continue;
      const sig = alertSignature(rec);
      if (g.lastAlertSignature === sig) continue; // already told this user
      if (!g.user.email) continue;

      await sendEmail({
        to: g.user.email,
        subject: `WhenToCut: ${g.name} — ${rec.action.replace(/_/g, " ")}`,
        text: formatAlert(g.name, rec),
        html: formatAlertHtml(g.name, rec, g.appid),
      });
      await prisma.trackedGame.update({
        where: { id: g.id },
        data: { lastAlertedAt: new Date(), lastAlertSignature: sig },
      });
      sent++;
    } catch (e) {
      errors.push(`appid ${g.appid}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, evaluated, sent, errors });
}
