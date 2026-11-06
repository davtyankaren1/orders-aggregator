import { z } from "zod";
import { ValidationError } from "../errors.js";
import type { Order, OrdersRepository, SaveResult } from "../repositories/orders.js";
import { parseRub, toKop } from "../utils/money.js";
import { parseUtc } from "../utils/time.js";

const ExternalOrder = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  amount: z.union([z.number(), z.string()]),
  discountPercent: z.union([z.number(), z.string()]).nullish(),
  amountPaid: z.union([z.number(), z.string()]).nullish(),
  status: z.enum(["pending", "paid", "refunded"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ApplyResult = SaveResult;

export class OrdersService {
  constructor(private readonly orders: OrdersRepository) {}

  normalize(raw: unknown): Order {
    const parsed = ExternalOrder.safeParse(raw);
    if (!parsed.success) throw new ValidationError(`invalid order: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
    const o = parsed.data;
    try {
      return {
        id: o.id,
        customerId: o.customerId,
        amountKop: toKop(parseRub(o.amount)),
        discountPercent: o.discountPercent == null ? null : parsePercent(o.discountPercent),
        amountPaidKop: o.amountPaid == null ? null : toKop(parseRub(o.amountPaid)),
        status: o.status,
        createdAt: parseUtc(o.createdAt),
        updatedAt: parseUtc(o.updatedAt),
      };
    } catch (e) {
      throw new ValidationError((e as Error).message);
    }
  }

  async apply(raw: unknown): Promise<ApplyResult> {
    return this.orders.saveIfNewer(this.normalize(raw));
  }
}

function parsePercent(raw: number | string): number {
  const value = typeof raw === "string" ? Number(raw.trim()) : raw;
  if (!Number.isFinite(value) || value < 0 || value > 100 || (typeof raw === "string" && raw.trim() === "")) {
    throw new Error(`invalid discountPercent: ${JSON.stringify(raw)}`);
  }
  return value;
}
