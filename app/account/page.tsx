import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { untrackGame } from "./actions";
import { FREE_TRACK_LIMIT } from "@/lib/plan";
import ConnectSteamForm from "./ConnectSteamForm";

export const dynamic = "force-dynamic";

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const { upgraded } = await searchParams;

  const [games, credential] = await Promise.all([
    prisma.trackedGame.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnerCredential.findUnique({ where: { userId: session.user.id } }),
  ]);

  const isPro = session.user.plan === "PRO";
  const billingReady = Boolean(process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_PRODUCT_ID);
  const checkoutHref =
    `/api/polar/checkout?products=${process.env.POLAR_PRODUCT_ID}` +
    `&customerExternalId=${session.user.id}` +
    `&customerEmail=${encodeURIComponent(session.user.email ?? "")}`;

  return (
    <div className="container">
      <h1>Your account</h1>
      <p className="muted">
        {session.user.email} ·{" "}
        <span className={`badge ${isPro ? "schedule_for_sale" : "hold"}`}>
          {isPro ? "PRO" : "FREE"}
        </span>
      </p>

      <div className="panel">
        <h2>Tracked games</h2>
        {games.length === 0 ? (
          <p className="muted">
            No games yet. Open a <Link href="/">game&apos;s dashboard</Link> and hit
            “Track this game”.
          </p>
        ) : (
          <ul className="list">
            {games.map((g) => (
              <li key={g.id}>
                <Link href={`/dashboard/${g.appid}`}>{g.name}</Link>
                <form action={untrackGame.bind(null, g.appid)}>
                  <button className="link-btn" type="submit">Untrack</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {upgraded === "1" && (
          <p className="sale-yes" style={{ marginTop: 12 }}>
            ✓ Thanks for subscribing! Your Pro features unlock as soon as the payment
            confirms (usually seconds).
          </p>
        )}
        {!isPro && (
          <div style={{ marginTop: 12 }}>
            <p className="muted">
              Free plan tracks {FREE_TRACK_LIMIT} game. Pro unlocks unlimited tracked
              games + alerts.
            </p>
            {billingReady ? (
              <a href={checkoutHref} className="badge schedule_for_sale" style={{ display: "inline-block", padding: "10px 16px", textDecoration: "none", marginTop: 6 }}>
                Upgrade to Pro — $9.99/mo
              </a>
            ) : (
              <p className="muted"><em>Billing isn&apos;t configured yet.</em></p>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Steamworks data</h2>
        <ConnectSteamForm connected={Boolean(credential)} />
      </div>
    </div>
  );
}
