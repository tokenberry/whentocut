import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listPartnerApps,
  fetchDetailedSales,
  fetchPartnerStats,
} from "./partnerClient";
import {
  parseMoneyToCents,
  toPacificDate,
  toGmtDate,
  normalizeSlashDate,
  redactKey,
  PartnerAuthError,
} from "./partnerApiClient";
import { clearCache } from "./cache";

const KEY = "TESTKEY_0123456789ABCDEF";

/** Build a fetch mock that dispatches on the request path. */
function mockFetch(handler: (url: URL) => unknown | { __status: number }) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const result = handler(url) as { __status?: number };
    if (result && typeof result === "object" && "__status" in result) {
      const status = result.__status as number;
      return { ok: status >= 200 && status < 300, status, json: async () => ({}) } as Response;
    }
    return { ok: true, status: 200, json: async () => result } as unknown as Response;
  });
}

beforeEach(() => clearCache());
afterEach(() => vi.restoreAllMocks());

describe("helpers", () => {
  it("parses decimal-string USD to integer cents", () => {
    expect(parseMoneyToCents("9.9900")).toBe(999);
    expect(parseMoneyToCents("0")).toBe(0);
    expect(parseMoneyToCents(undefined)).toBe(0);
    expect(parseMoneyToCents("garbage")).toBe(0);
  });

  it("formats Pacific vs GMT dates (TZ-correct around midnight UTC)", () => {
    // 2026-06-28T05:30Z is still 2026-06-27 in Los Angeles.
    const d = new Date("2026-06-28T05:30:00Z");
    expect(toGmtDate(d)).toBe("2026-06-28");
    expect(toPacificDate(d)).toBe("2026-06-27");
  });

  it("normalizes slash dates to dashes", () => {
    expect(normalizeSlashDate("2026/04/03")).toBe("2026-04-03");
  });

  it("redacts the key from arbitrary text", () => {
    expect(redactKey(`failed for key=${KEY} oops`, KEY)).toBe("failed for key=[REDACTED] oops");
  });
});

describe("listPartnerApps", () => {
  it("returns appids and tolerates both response shapes", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ applist: { apps: [{ appid: 1, name: "A" }, { appid: 2 }] } })),
    );
    const apps = await listPartnerApps(KEY);
    expect(apps.map((a) => a.appid)).toEqual([1, 2]);
    expect(apps[1].name).toBeNull();
  });

  it("throws PartnerAuthError on 403", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ __status: 403 })));
    await expect(listPartnerApps(KEY)).rejects.toBeInstanceOf(PartnerAuthError);
  });
});

describe("fetchDetailedSales pagination", () => {
  it("follows max_id until exhausted", async () => {
    const fetchMock = mockFetch((url) => {
      const hwm = Number(url.searchParams.get("highwatermark_id"));
      if (hwm === 0) {
        return { response: { results: [{ date: "2026-04-03", primary_appid: 10, net_sales_usd: "5.00" }], max_id: "100" } };
      }
      if (hwm === 100) {
        return { response: { results: [{ date: "2026-04-03", primary_appid: 10, net_sales_usd: "3.00" }], max_id: "100" } };
      }
      return { response: { results: [], max_id: "0" } };
    });
    vi.stubGlobal("fetch", fetchMock);
    const lines = await fetchDetailedSales(KEY, "2026-04-03");
    expect(lines).toHaveLength(2);
  });

  it("never includes the key in any thrown message", async () => {
    vi.stubGlobal("fetch", mockFetch(() => ({ __status: 500 })));
    try {
      await fetchDetailedSales(KEY, "2026-04-03");
      throw new Error("should have thrown");
    } catch (e) {
      expect(String((e as Error).message)).not.toContain(KEY);
    }
  });
});

describe("fetchPartnerStats aggregation", () => {
  it("returns null without credentials", async () => {
    expect(await fetchPartnerStats(10, null)).toBeNull();
    expect(await fetchPartnerStats(10, { webApiKey: "" })).toBeNull();
  });

  it("sums revenue/units for the matching appid and net wishlist adds", async () => {
    const now = new Date("2026-04-10T12:00:00Z");
    const fetchMock = mockFetch((url) => {
      if (url.pathname.includes("GetDetailedSales")) {
        // Two line items: one for our app (10), one for another (99) to be filtered out.
        return {
          response: {
            results: [
              { date: "x", primary_appid: 10, net_sales_usd: "10.00", net_units_sold: 2 },
              { date: "x", primary_appid: 99, net_sales_usd: "50.00", net_units_sold: 9 },
            ],
            max_id: "0",
          },
        };
      }
      if (url.pathname.includes("GetAppWishlistReporting")) {
        return {
          response: {
            appid: 10,
            wishlist_summary: { wishlist_adds: 5, wishlist_deletes: 1, wishlist_purchases: 1 },
          },
        };
      }
      return {};
    });
    vi.stubGlobal("fetch", fetchMock);

    const stats = await fetchPartnerStats(10, { webApiKey: KEY }, now);
    expect(stats).not.toBeNull();
    // 30 days × $10.00 net for app 10 only.
    expect(stats!.revenueTrailing30dCents).toBe(30 * 1000);
    expect(stats!.unitsTrailing30d).toBe(30 * 2);
    // 30 days × (5 - 1 - 1) = 90 net adds.
    expect(stats!.wishlistAdds30d).toBe(30 * 3);
    expect(stats!.connected).toBe(true);
    // Never includes the key in any cached/returned field.
    expect(JSON.stringify(stats)).not.toContain(KEY);
  });
});
