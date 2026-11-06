import type { Db } from "../db.js";

export interface Order {
  id: string;
  customerId: string;
  amountKop: number;
  discountPercent: number | null;
  amountPaidKop: number | null;
  status: "pending" | "paid" | "refunded";
  createdAt: Date;
  updatedAt: Date;
}

interface Row {
  id: string;
  customer_id: string;
  amount_kop: string;
  discount_percent: string | null;
  amount_paid_kop: string | null;
  status: Order["status"];
  created_at: Date;
  updated_at: Date;
}

const fromRow = (r: Row): Order => ({
  id: r.id,
  customerId: r.customer_id,
  amountKop: Number(r.amount_kop),
  discountPercent: r.discount_percent === null ? null : Number(r.discount_percent),
  amountPaidKop: r.amount_paid_kop === null ? null : Number(r.amount_paid_kop),
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type SaveResult = "created" | "updated" | "stale";

export class OrdersRepository {
  constructor(private readonly db: Db) {}

  async get(id: string): Promise<Order | null> {
    const { rows } = await this.db.query<Row>(`SELECT * FROM orders WHERE id = $1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async saveIfNewer(o: Order): Promise<SaveResult> {
    const { rows } = await this.db.query<{ inserted: boolean }>(
      `INSERT INTO orders AS cur
              (id, customer_id, amount_kop, discount_percent, amount_paid_kop, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         customer_id      = excluded.customer_id,
         amount_kop       = excluded.amount_kop,
         discount_percent = excluded.discount_percent,
         amount_paid_kop  = excluded.amount_paid_kop,
         status           = excluded.status,
         created_at       = excluded.created_at,
         updated_at       = excluded.updated_at
       WHERE cur.updated_at < excluded.updated_at
          OR (cur.updated_at = excluded.updated_at
              AND cur.amount_paid_kop IS NULL AND excluded.amount_paid_kop IS NOT NULL)
       RETURNING (xmax = 0) AS inserted`,
      [o.id, o.customerId, o.amountKop, o.discountPercent, o.amountPaidKop, o.status, o.createdAt, o.updatedAt],
    );
    if (rows.length === 0) return "stale";
    return rows[0].inserted ? "created" : "updated";
  }

  async paidCreatedBetween(customerId: string, from: Date, to: Date): Promise<Order[]> {
    const { rows } = await this.db.query<Row>(
      `SELECT * FROM orders
        WHERE customer_id = $1 AND status = 'paid' AND created_at >= $2 AND created_at < $3`,
      [customerId, from, to],
    );
    return rows.map(fromRow);
  }
}
