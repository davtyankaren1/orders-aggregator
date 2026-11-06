
export function parseRub(raw: unknown): number {
  const value = typeof raw === "string" ? Number(raw.trim()) : raw;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`invalid amount: ${JSON.stringify(raw)}`);
  }
  return value;
}

export function toKop(rub: number): number {
  return Math.floor(Number((rub * 100).toFixed(6)));
}

export function fromKop(kop: number): number {
  return kop / 100;
}
