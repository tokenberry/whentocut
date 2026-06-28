# WhenToCut

**Data-driven discount timing & sizing for indie Steam developers.** Tell me a game's
appID and WhenToCut analyzes its price level, rivals, player numbers, and Steam's own
discount rules to answer: *should you discount now, by how much, and when?* — with the
reasons spelled out.

> **Why advisory, not automated?** Steam has **no API to apply discounts**. Discounts are
> created only in the [Steamworks partner portal](https://partner.steamgames.com/) and go
> through Valve review, with hard rules (30-day cooldown between discounts, 30-day lockout
> after a price increase, advance scheduling). So WhenToCut recommends and alerts; **you**
> apply the discount in Steamworks. See
> [Steam's discounting docs](https://partner.steamgames.com/doc/marketing/discounts).

## How it works

1. **Public data** (no login): Steam Store `appdetails` (price, base price, genres,
   release date), [SteamSpy](https://steamspy.com/api.php) (owners, reviews, tags),
   Steam Web API `GetNumberOfCurrentPlayers` (live players). Rivals are discovered by
   the game's top tag.
2. **Optional private data**: set a Steamworks **partner** Web API key
   (`STEAMWORKS_PARTNER_KEY`, or a financial key) and the dashboard enriches
   recommendations with your trailing-30-day **net revenue, units, and wishlist adds**
   from `partner.steam-api.com` (`IPartnerFinancialsService`). The key needs the
   "Sales Data" permission, is used **server-side only**, and is never logged or sent to
   the browser. `POST /api/connect { webApiKey }` validates a key and lists the appids it
   can access. Without a key, the app runs on public data alone.
3. **Recommendation engine** (`lib/recommendation/engine.ts`): a pure, unit-tested
   function that enforces Steam's hard rules first, then applies best practice — ease in,
   deepen depth over time, align to seasonal sales — with a value-erosion guardrail.
4. **Alerts** (Phase 4): a scheduler re-evaluates tracked games and notifies you (email
   / Discord) when it's time to act.

## Project layout

```
app/
  page.tsx                     landing — enter an appID
  dashboard/[appid]/page.tsx   recommendation + current state + rivals
  api/games/[appid]            public aggregate snapshot
  api/recommend/[appid]        snapshot + recommendation
  api/connect                  store a partner Web API key (server-side)
  api/cron/evaluate            periodic re-evaluation entrypoint (secret-guarded)
lib/
  steam/                       storeClient, steamSpyClient, webApiClient, partnerClient, aggregate
  recommendation/              types, rules, engine (+ tests), fromSnapshot
  alerts/                      notify (+ tests)
  salesCalendar.ts             Steam seasonal/themed sale dates (maintained config)
prisma/schema.prisma           Postgres model (TrackedGame, Snapshot, PartnerCredential, AlertSubscription)
```

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests (engine, sales calendar, alerts)
npm run typecheck
npm run build
```

Try a real game: open `/dashboard/1145360` (Hades) or `/dashboard/413150` (Stardew Valley).

## Status

- ✅ Phase 1 — public data clients + dashboard
- ✅ Phase 2 — recommendation engine + sales calendar (+ tests)
- ✅ Phase 3 — live Steamworks partner endpoints (sales/revenue/wishlist enrichment)
- 🚧 Phase 4 — Postgres persistence, snapshot history, cron + alerts (schema + stubs in place)

CI/CD: pushing to GitHub auto-deploys to the droplet via
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). See
[DEPLOY.md](./DEPLOY.md) for droplet provisioning, the auto-deploy secrets, Nginx/TLS,
and DO Spaces.
