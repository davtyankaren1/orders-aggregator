const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseUtc(raw: unknown): Date {
  if (typeof raw !== "string") throw new Error(`invalid date: ${JSON.stringify(raw)}`);
  const s = raw.trim();
  const d = new Date(HAS_ZONE.test(s) ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid date: ${JSON.stringify(raw)}`);
  return d;
}

export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

export function dateAtOffset(at: Date, offsetMinutes: number): string {
  return new Date(at.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function dateInTimeZone(at: Date, timeZone: string): string {
  let fmt = dateFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dateFormatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  return new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
