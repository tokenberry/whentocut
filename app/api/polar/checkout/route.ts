import { Checkout } from "@polar-sh/nextjs";

/**
 * GET /api/polar/checkout?products=<id>&customerExternalId=<userId>&customerEmail=<email>
 * Creates a Polar checkout and redirects the user to it. The /account "Upgrade" link
 * supplies the query params (product id + the signed-in user's id/email), so the
 * webhook can map the resulting subscription back to our user via customerExternalId.
 */
export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
  successUrl: "https://whentocut.com/account?upgraded=1",
  server: (process.env.POLAR_SERVER as "sandbox" | "production") || "production",
});
