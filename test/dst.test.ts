import { afterEach, describe, expect, it, vi } from "vitest";
import { apiOrder, dailyTotals, postWebhook, setupTestApp } from "./helpers.js";

const ctx = setupTestApp();

describe("daily-totals: переход на летнее время", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function seedBerlin() {
    ctx.api.customers.set("c_7", "Europe/Berlin");
    const orders = [
      { amount: 100, createdAt: "2026-03-27T22:40:00Z" },
      { amount: 200, createdAt: "2026-03-27T23:20:00Z" },
      { amount: 400, createdAt: "2026-03-29T21:30:00Z" },
      { amount: 800, createdAt: "2026-03-29T22:40:00Z" },
      { amount: 1600, createdAt: "2026-03-30T22:15:00" },
      { amount: 3200, createdAt: "2026-03-31T21:59:59Z" },
      { amount: 6400, createdAt: "2026-03-31T22:00:00Z" },
    ];
    for (const o of orders) await postWebhook(ctx.app, apiOrder({ customerId: "c_7", ...o, updatedAt: "2026-04-02T00:00:00Z" }));
  }

  const expected = [
    { date: "2026-03-27", total: 100 },
    { date: "2026-03-28", total: 200 },
    { date: "2026-03-29", total: 400 },
    { date: "2026-03-30", total: 800 },
    { date: "2026-03-31", total: 4800 },
  ];

  it.each([
    ["зимой (UTC+1, как в день жалобы)", "2026-11-06T12:00:00Z"],
    ["летом (UTC+2)", "2026-07-01T12:00:00Z"],
  ])("дни не зависят от даты запроса: %s", async (_label, now) => {
    await seedBerlin();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(now) });
    const res = await dailyTotals(ctx.app, "c_7", "2026-03-27", "2026-03-31");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject(expected);
  });

  it("переход на зимнее время (25.10.2026, UTC+2 → UTC+1)", async () => {
    ctx.api.customers.set("c_7", "Europe/Berlin");
    await postWebhook(ctx.app, apiOrder({ customerId: "c_7", amount: 10, createdAt: "2026-10-24T22:30:00Z" }));
    await postWebhook(ctx.app, apiOrder({ customerId: "c_7", amount: 20, createdAt: "2026-10-25T22:30:00Z" }));
    await postWebhook(ctx.app, apiOrder({ customerId: "c_7", amount: 40, createdAt: "2026-10-25T23:00:00Z" }));
    const res = await dailyTotals(ctx.app, "c_7", "2026-10-24", "2026-10-26");
    expect(res.json()).toMatchObject([
      { date: "2026-10-24", total: 0 },
      { date: "2026-10-25", total: 30 },
      { date: "2026-10-26", total: 40 },
    ]);
  });
});
