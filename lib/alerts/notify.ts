import { Recommendation } from "../recommendation/types";

/**
 * Alert delivery. Phase 4 wires Resend (email) and Discord webhooks. Kept as a thin
 * seam now so the cron evaluator can call it without knowing the transport.
 *
 * An alert is worth sending when the recommendation is actionable AND time-sensitive:
 * a sale window's "act by" date is near, or a discount is live/imminent.
 */

export type AlertChannel = "EMAIL" | "DISCORD";

export interface AlertTarget {
  channel: AlertChannel;
  target: string; // email address or Discord webhook URL
}

/** Decide whether a recommendation merits an alert right now. */
export function shouldAlert(rec: Recommendation, now: Date = new Date()): boolean {
  if (rec.action === "discount_now") return true;
  if (rec.action === "schedule_for_sale" && rec.actByDate) {
    const days = Math.ceil((new Date(rec.actByDate).getTime() - now.getTime()) / 86_400_000);
    return days <= 10; // nudge ~10 days before the scheduling deadline
  }
  return false;
}

export function formatAlert(gameName: string, rec: Recommendation): string {
  const depth = rec.suggestedDiscountPct !== null ? `${rec.suggestedDiscountPct}%` : "—";
  const window = rec.window ? `${rec.window.label} (${rec.window.start})` : "n/a";
  return [
    `WhenToCut — ${gameName}`,
    `Action: ${rec.action} · Depth: ${depth} · Window: ${window}`,
    rec.actByDate ? `Act by: ${rec.actByDate}` : "",
    "",
    ...rec.reasons.map((r) => `• ${r}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendAlert(_to: AlertTarget, _message: string): Promise<void> {
  // Phase 4: switch on channel -> Resend API / Discord webhook POST.
  throw new Error("Alert delivery not yet wired (Phase 4).");
}
