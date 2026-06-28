/**
 * Minimal Resend email sender (HTTP API, no SDK). Server-side only.
 * Uses RESEND_API_KEY, falling back to AUTH_RESEND_KEY (the magic-link key) so a single
 * Resend key can power both auth and alerts.
 */

const RESEND_URL = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim() || process.env.AUTH_RESEND_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY (or AUTH_RESEND_KEY) is not set");
  const from = process.env.ALERT_FROM_EMAIL?.trim() || "alerts@whentocut.com";

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  if (!res.ok) {
    // Don't leak the key; Resend errors don't echo it, but be explicit about status only.
    throw new Error(`Resend send failed: HTTP ${res.status}`);
  }
}
