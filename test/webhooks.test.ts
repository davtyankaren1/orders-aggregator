import { describe, expect, it } from "vitest";
import { apiOrder, postWebhook, setupTestApp } from "./helpers.js";

const ctx = setupTestApp();

describe("POST /webhooks/order", () => {
  it("создаёт заказ", async () => {
    const res = await postWebhook(ctx.app, apiOrder());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ result: "created" });
  });

  it("повтор того же события ничего не меняет", async () => {
    const o = apiOrder();
    await postWebhook(ctx.app, o);
    expect((await postWebhook(ctx.app, o)).json()).toEqual({ result: "stale" });
  });

  it("устаревшее событие после нового игнорируется", async () => {
    const o = apiOrder({ status: "paid", updatedAt: "2026-02-10T12:00:00Z" });
    await postWebhook(ctx.app, { ...o, status: "refunded", updatedAt: "2026-02-11T12:00:00Z" });
    expect((await postWebhook(ctx.app, o)).json()).toEqual({ result: "stale" });
    const { rows } = await ctx.db.query(`SELECT status FROM orders WHERE id = $1`, [o.id]);
    expect(rows[0].status).toBe("refunded");
  });

  it("новое событие обновляет заказ", async () => {
    const o = apiOrder({ status: "pending" });
    await postWebhook(ctx.app, o);
    const res = await postWebhook(ctx.app, { ...o, status: "paid", updatedAt: "2026-02-11T00:00:00Z" });
    expect(res.json()).toEqual({ result: "updated" });
  });

  it("параллельные вебхуки не по порядку: побеждает самая новая версия", async () => {
    for (let round = 0; round < 10; round++) {
      const o = apiOrder({ status: "pending", updatedAt: "2026-02-10T12:00:00Z" });
      await postWebhook(ctx.app, o);
      const newest = { ...o, status: "refunded", updatedAt: "2026-02-10T14:00:00Z" };
      const older = { ...o, status: "paid", updatedAt: "2026-02-10T13:00:00Z" };
      const results = await Promise.all(
        [older, newest, older, older, newest, older, older, older].map((v) => postWebhook(ctx.app, v)),
      );
      expect(results.every((r) => r.statusCode === 200)).toBe(true);
      const { rows } = await ctx.db.query(`SELECT status, updated_at FROM orders WHERE id = $1`, [o.id]);
      expect(rows[0].status).toBe("refunded");
      expect(rows[0].updated_at.toISOString()).toBe("2026-02-10T14:00:00.000Z");
    }
  });

  it("одновременная доставка одного и того же нового заказа: ровно один created", async () => {
    const o = apiOrder();
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => postWebhook(ctx.app, o)));
    const bodies = results.map((r) => r.json().result).sort();
    expect(bodies).toEqual(["created", "stale", "stale", "stale", "stale"]);
  });

  it("невалидное тело — 400", async () => {
    const res = await postWebhook(ctx.app, { id: "x" });
    expect(res.statusCode).toBe(400);
  });
});
