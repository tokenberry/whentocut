import { Webhooks } from "@polar-sh/nextjs";
import { prisma } from "@/lib/db";

/**
 * POST /api/polar/webhook — Polar subscription events (signature-verified).
 * Flips the user's plan: active subscription -> PRO, revoked -> FREE. The user is
 * matched by customer.externalId (the user id we passed at checkout), falling back
 * to the customer email.
 */

type SubscriptionLike = {
  id?: string;
  status?: string;
  customerId?: string;
  customer?: { id?: string; email?: string | null; externalId?: string | null };
};

async function setPlan(sub: SubscriptionLike, plan: "FREE" | "PRO"): Promise<void> {
  const externalId = sub.customer?.externalId ?? null;
  const email = sub.customer?.email ?? null;
  const where = externalId ? { id: externalId } : email ? { email } : null;
  if (!where) return;
  await prisma.user
    .update({
      where,
      data: {
        plan,
        polarCustomerId: sub.customerId ?? sub.customer?.id ?? undefined,
        polarSubscriptionId: sub.id ?? undefined,
      },
    })
    .catch(() => {
      // User may not exist yet / race — ignore so the webhook still 200s.
    });
}

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",
  // Becomes active after a successful payment.
  onSubscriptionActive: async (payload) => {
    await setPlan(payload.data, "PRO");
  },
  // Status changes (reactivation, past_due, etc.) — sync from the status.
  onSubscriptionUpdated: async (payload) => {
    const active = payload.data.status === "active" || payload.data.status === "trialing";
    await setPlan(payload.data, active ? "PRO" : "FREE");
  },
  // Access actually ended (after any cancellation grace period).
  onSubscriptionRevoked: async (payload) => {
    await setPlan(payload.data, "FREE");
  },
  // Note: `subscription.canceled` only *schedules* cancellation — access continues
  // until the period ends, so we intentionally don't downgrade there.
});
