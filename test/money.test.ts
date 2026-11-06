import { describe, expect, it } from "vitest";
import { fromKop, parseRub, toKop } from "../src/utils/money.js";

describe("parseRub", () => {
  it("принимает число и строку с числом", () => {
    expect(parseRub(2500)).toBe(2500);
    expect(parseRub("2500.00")).toBe(2500);
    expect(parseRub(" 99 ")).toBe(99);
  });

  it("отклоняет мусор и отрицательные суммы", () => {
    expect(() => parseRub("abc")).toThrow();
    expect(() => parseRub(null)).toThrow();
    expect(() => parseRub(-1)).toThrow();
  });
});

describe("toKop / fromKop", () => {
  it("рубли в копейки", () => {
    expect(toKop(2500)).toBe(250000);
    expect(toKop(99)).toBe(9900);
  });

  it("отбрасывает доли копейки", () => {
    expect(toKop(10.999)).toBe(1099);
  });

  it("не теряет копейку из-за двоичной плавающей точки", () => {
    expect(toKop(4723.9)).toBe(472390);
    expect(toKop(0.29)).toBe(29);
    expect(toKop(1217.61)).toBe(121761);
    expect(toKop(5248.78)).toBe(524878);
    expect(toKop(0)).toBe(0);
  });

  it("на реальных суммах с двумя знаками совпадает с точным переводом", () => {
    for (let kop = 0; kop <= 1_000_000; kop += 7) {
      expect(toKop(Number((kop / 100).toFixed(2)))).toBe(kop);
    }
  });

  it("копейки в рубли", () => {
    expect(fromKop(250000)).toBe(2500);
    expect(fromKop(1099)).toBe(10.99);
  });
});
