import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { untrackGame, FREE_TRACK_LIMIT } from "./actions";
import ConnectSteamForm from "./ConnectSteamForm";

export const dynamic = "force-dynamic";

export default async function Account() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [games, credential] = await Promise.all([
    prisma.trackedGame.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnerCredential.findUnique({ where: { userId: session.user.id } }),
  ]);

  const isPro = session.user.plan === "PRO";

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
        {!isPro && (
          <p className="muted" style={{ marginTop: 12 }}>
            Free plan tracks {FREE_TRACK_LIMIT} game. Pro unlocks unlimited games + email
            alerts — <em>billing coming soon (Lemon Squeezy)</em>.
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Steamworks data</h2>
        <ConnectSteamForm connected={Boolean(credential)} />
      </div>
    </div>
  );
}
