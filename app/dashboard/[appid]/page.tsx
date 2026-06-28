import Link from "next/link";
import { buildSnapshot } from "@/lib/steam/aggregate";
import { getPartnerStatsForApp } from "@/lib/steam/partnerData";
import { PartnerStats } from "@/lib/steam/partnerClient";
import { inputFromSnapshot } from "@/lib/recommendation/fromSnapshot";
import { recommend } from "@/lib/recommendation/engine";
import { Recommendation } from "@/lib/recommendation/types";
import { GameSnapshot } from "@/lib/steam/types";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { trackGame, untrackGame } from "@/app/account/actions";

export const dynamic = "force-dynamic"; // always reflect live Steam data

const ACTION_LABEL: Record<Recommendation["action"], string> = {
  discount_now: "Discount now",
  schedule_for_sale: "Schedule for next sale",
  hold: "Hold full price",
  blocked: "Discount blocked",
};

function price(cents: number | null, currency: string | null): string {
  if (cents === null) return "—";
  if (cents === 0) return "Free";
  return `${currency ?? "$"}${(cents / 100).toFixed(2)}`;
}

export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ appid: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { appid: raw } = await params;
  const { limit } = await searchParams;
  const appid = Number(raw);

  if (!Number.isInteger(appid) || appid <= 0) {
    return <Shell><p className="error">Invalid appID.</p></Shell>;
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  let snapshot: GameSnapshot | null = null;
  let rec: Recommendation | null = null;
  let partner: PartnerStats | null = null;
  let error: string | null = null;

  try {
    snapshot = await buildSnapshot(appid);
    if (snapshot) {
      partner = await getPartnerStatsForApp(appid, userId);
      rec = recommend(inputFromSnapshot(snapshot, partner));
    }
  } catch (e) {
    error = String(e);
  }

  if (error) return <Shell><p className="error">Failed to load: {error}</p></Shell>;
  if (!snapshot || !rec)
    return <Shell><p className="error">No Steam app found for appid {appid}.</p></Shell>;

  const isTracked = userId
    ? Boolean(
        await prisma.trackedGame.findUnique({
          where: { userId_appid: { userId, appid } },
        }),
      )
    : false;

  const { core, stats, rivals } = snapshot;

  return (
    <Shell>
      <h1 style={{ marginBottom: 2 }}>{core.name}</h1>
      <p className="muted">
        appID {core.appid} ·{" "}
        <a href={`https://store.steampowered.com/app/${core.appid}`} target="_blank" rel="noreferrer">
          Steam store ↗
        </a>{" "}
        · {core.genres.join(", ") || "—"}
      </p>

      {/* Track control */}
      <div style={{ margin: "12px 0" }}>
        {!userId ? (
          <Link href="/signin" className="link-btn">
            Sign in to track &amp; get alerts
          </Link>
        ) : isTracked ? (
          <form action={untrackGame.bind(null, core.appid)}>
            <button className="link-btn" type="submit">✓ Tracking — untrack</button>
          </form>
        ) : (
          <form action={trackGame.bind(null, core.appid, core.name)}>
            <button type="submit">＋ Track this game</button>
          </form>
        )}
        {limit === "1" && (
          <p className="error" style={{ marginTop: 8 }}>
            Free plan tracks 1 game. <Link href="/account">Upgrade to Pro</Link> to track more.
          </p>
        )}
      </div>

      {/* Recommendation */}
      <div className="panel">
        <span className={`badge ${rec.action}`}>{ACTION_LABEL[rec.action]}</span>
        <div className="rec-headline">
          {rec.suggestedDiscountPct !== null
            ? `Suggested discount: ${rec.suggestedDiscountPct}%`
            : "No discount right now"}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {rec.window ? `Target window: ${rec.window.label} (${rec.window.start} → ${rec.window.end})` : "No target window"}
          {rec.actByDate ? ` · Act by ${rec.actByDate}` : ""}
          {` · Confidence ${(rec.confidence * 100).toFixed(0)}%`}
        </p>
        <ul className="reasons">
          {rec.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      {/* Current state */}
      <div className="panel">
        <h2>Current state</h2>
        <div className="stat-grid">
          <Stat label="Price" value={price(core.currentPriceCents, core.currency)} />
          <Stat
            label="Base price"
            value={price(core.basePriceCents, core.currency)}
          />
          <Stat
            label="Live discount"
            value={core.currentDiscountPct > 0 ? `${core.currentDiscountPct}%` : "None"}
          />
          <Stat label="Released" value={core.releaseDate ?? "—"} />
          <Stat
            label="Players now"
            value={stats.currentPlayers !== null ? stats.currentPlayers.toLocaleString() : "—"}
          />
          <Stat label="Est. owners" value={stats.ownersRange ?? "—"} />
          <Stat
            label="Reviews (+/−)"
            value={
              stats.positiveReviews !== null
                ? `${stats.positiveReviews.toLocaleString()} / ${(stats.negativeReviews ?? 0).toLocaleString()}`
                : "—"
            }
          />
        </div>
      </div>

      {/* Private partner data (only when a Steamworks key is configured) */}
      {partner?.connected && (
        <div className="panel">
          <h2>Your Steamworks data <span className="badge schedule_for_sale">connected</span></h2>
          <div className="stat-grid">
            <Stat
              label="Units (30d)"
              value={partner.unitsTrailing30d !== null ? partner.unitsTrailing30d.toLocaleString() : "—"}
            />
            <Stat
              label="Net revenue (30d)"
              value={
                partner.revenueTrailing30dCents !== null
                  ? `$${(partner.revenueTrailing30dCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "—"
              }
            />
            <Stat
              label="Wishlist adds (30d, net)"
              value={partner.wishlistAdds30d !== null ? partner.wishlistAdds30d.toLocaleString() : "—"}
            />
          </div>
        </div>
      )}

      {/* Rivals */}
      <div className="panel">
        <h2>Rivals {stats.topTags[0] ? `(by tag: ${stats.topTags[0]})` : ""}</h2>
        {rivals.length === 0 ? (
          <p className="muted">No rivals found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Price</th>
                <th>Discount</th>
                <th>On sale?</th>
              </tr>
            </thead>
            <tbody>
              {rivals.map((r) => (
                <tr key={r.appid}>
                  <td>
                    <a href={`/dashboard/${r.appid}`}>{r.name}</a>
                  </td>
                  <td>{price(r.currentPriceCents, r.currency)}</td>
                  <td>{r.currentDiscountPct > 0 ? `${r.currentDiscountPct}%` : "—"}</td>
                  <td className={r.onSale ? "sale-yes" : "sale-no"}>
                    {r.onSale ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
        Apply the recommendation yourself in the{" "}
        <a href="https://partner.steamgames.com/" target="_blank" rel="noreferrer">
          Steamworks partner portal
        </a>
        . Steam reviews price/discount changes before they go live, so schedule with lead time.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container">{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
