import { describe, expect, it } from "vitest";
import { apiOrder, dailyTotals, postWebhook, setupTestApp } from "./helpers.js";

const ctx = setupTestApp();

describe("daily-totals: скидки", () => {
  it("отдаёт gross / discount / net, total = gross", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 2500, discountPercent: 16.5, amountPaid: 2087.5 }));
    const res = await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ date: "2026-02-10", total: 2500, gross: 2500, discount: 412.5, net: 2087.5 }]);
  });

  it("суммирует несколько заказов за день с точностью до копейки", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 1000, discountPercent: 33, amountPaid: 670 }));
    await postWebhook(ctx.app, apiOrder({ amount: "1217.61", discountPercent: "0", amountPaid: "1217.61" }));
    await postWebhook(ctx.app, apiOrder({ amount: 5085, discountPercent: 38, amountPaid: 3152.7 }));
    await postWebhook(ctx.app, apiOrder({ amount: 0.1, discountPercent: 0, amountPaid: 0.1 }));
    await postWebhook(ctx.app, apiOrder({ amount: 0.2, discountPercent: 0, amountPaid: 0.2 }));
    const [day] = (await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10")).json();
    expect(day).toEqual({ date: "2026-02-10", total: 7302.91, gross: 7302.91, discount: 2262.3, net: 5040.61 });
  });

  it("amountPaid с «плохим» двоичным представлением не теряет копейку (4723.9 * 100 = 472389.99…)", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 5248.78, discountPercent: 10, amountPaid: 4723.9 }));
    const [day] = (await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10")).json();
    expect(day).toMatchObject({ gross: 5248.78, net: 4723.9, discount: 524.88 });
  });

  it("заказ без полей скидки (старые заказы) — net = gross, discount = 0", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 700 }));
    await postWebhook(ctx.app, apiOrder({ amount: 300, discountPercent: null, amountPaid: null }));
    const [day] = (await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10")).json();
    expect(day).toEqual({ date: "2026-02-10", total: 1000, gross: 1000, discount: 0, net: 1000 });
  });

  it("дни без оплат и неоплаченные заказы — нули во всех полях", async () => {
    await postWebhook(ctx.app, apiOrder({ amount: 900, discountPercent: 10, amountPaid: 810, status: "refunded" }));
    await postWebhook(ctx.app, apiOrder({ amount: 900, discountPercent: 10, amountPaid: 810, status: "pending" }));
    const res = await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-11");
    expect(res.json()).toEqual([
      { date: "2026-02-10", total: 0, gross: 0, discount: 0, net: 0 },
      { date: "2026-02-11", total: 0, gross: 0, discount: 0, net: 0 },
    ]);
  });

  it("скидка, изменённая более новой версией заказа, пересчитывается; старая версия — нет", async () => {
    const o = apiOrder({ amount: 1000, discountPercent: 5, amountPaid: 950, updatedAt: "2026-02-10T13:00:00Z" });
    await postWebhook(ctx.app, o);
    await postWebhook(ctx.app, { ...o, discountPercent: 33, amountPaid: 670, updatedAt: "2026-02-10T15:00:00Z" });
    await postWebhook(ctx.app, { ...o, discountPercent: 10, amountPaid: 900, updatedAt: "2026-02-10T14:00:00Z" });
    const [day] = (await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10")).json();
    expect(day).toMatchObject({ gross: 1000, discount: 330, net: 670 });
  });

  it("невалидная скидка — 400", async () => {
    expect((await postWebhook(ctx.app, apiOrder({ discountPercent: "abc", amountPaid: 1000 }))).statusCode).toBe(400);
    expect((await postWebhook(ctx.app, apiOrder({ discountPercent: 150, amountPaid: 1000 }))).statusCode).toBe(400);
    expect((await postWebhook(ctx.app, apiOrder({ discountPercent: 10, amountPaid: -5 }))).statusCode).toBe(400);
  });
});

describe("синк: поля скидки", () => {
  it("повторный синк дозаполняет скидку у заказа, сохранённого без неё (та же версия)", async () => {
    const o = apiOrder({ amount: 1000 });
    await postWebhook(ctx.app, o);

    ctx.api.pages.set(null, { items: [{ ...o, discountPercent: 10, amountPaid: 900 }], nextCursor: null });
    const res = await ctx.app.inject({ method: "POST", url: "/sync" });
    expect(res.json()).toMatchObject({ applied: 1, stale: 0 });

    const [day] = (await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10")).json();
    expect(day).toMatchObject({ gross: 1000, discount: 100, net: 900 });
  });

  it("та же версия без полей скидки не затирает уже сохранённую скидку", async () => {
    const o = apiOrder({ amount: 1000, discountPercent: 10, amountPaid: 900 });
    await postWebhook(ctx.app, o);
    const { discountPercent: _d, amountPaid: _p, ...withoutDiscount } = o as Record<string, unknown>;
    expect((await postWebhook(ctx.app, withoutDiscount)).json()).toEqual({ result: "stale" });
    const [day] = (await dailyTotals(ctx.app, "c_1", "2026-02-10", "2026-02-10")).json();
    expect(day).toMatchObject({ net: 900 });
  });
});
