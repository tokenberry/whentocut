import { Recommendation } from "../recommendation/types";

/**
 * An alert is worth sending when the recommendation is actionable AND time-sensitive:
 * a discount is live/imminent, or a sale window's "act by" date is near.
 */
export function shouldAlert(rec: Recommendation, now: Date = new Date()): boolean {
  if (rec.action === "discount_now") return true;
  if (rec.action === "schedule_for_sale" && rec.actByDate) {
    const days = Math.ceil((new Date(rec.actByDate).getTime() - now.getTime()) / 86_400_000);
    return days <= 10; // nudge ~10 days before the scheduling deadline
  }
  return false;
}

/**
 * A stable fingerprint of the actionable parts of a recommendation. The cron evaluator
 * stores this per tracked game and only re-emails when it changes — so a user isn't
 * spammed daily with the same "discount now 20%" message.
 */
export function alertSignature(rec: Recommendation): string {
  return [rec.action, rec.suggestedDiscountPct ?? "-", rec.window?.label ?? "-"].join("|");
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
    "",
    `Apply it in Steamworks: https://partner.steamgames.com/`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatAlertHtml(gameName: string, rec: Recommendation, appid: number): string {
  const depth = rec.suggestedDiscountPct !== null ? `${rec.suggestedDiscountPct}%` : "—";
  const window = rec.window ? `${rec.window.label} (${rec.window.start} → ${rec.window.end})` : "n/a";
  const reasons = rec.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  return `
  <div style="font-family:system-ui,sans-serif;max-width:560px">
    <h2 style="margin:0 0 4px">${escapeHtml(gameName)}</h2>
    <p style="color:#555;margin:0 0 12px">
      <strong>${escapeHtml(rec.action.replace(/_/g, " "))}</strong>
      · Suggested depth: <strong>${depth}</strong> · Window: ${escapeHtml(window)}
      ${rec.actByDate ? `· Act by <strong>${rec.actByDate}</strong>` : ""}
    </p>
    <ul style="color:#333;line-height:1.5">${reasons}</ul>
    <p style="margin-top:16px">
      <a href="https://whentocut.com/dashboard/${appid}">View on WhenToCut</a> ·
      <a href="https://partner.steamgames.com/">Apply in Steamworks</a>
    </p>
    <p style="color:#999;font-size:12px;margin-top:20px">
      You're receiving this because you track ${escapeHtml(gameName)} on WhenToCut.
      Manage at https://whentocut.com/account
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
