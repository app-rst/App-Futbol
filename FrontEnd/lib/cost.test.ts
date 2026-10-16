import { describe, expect, it } from "vitest";
import { costPerPlayer, formatARS, parseARS } from "./cost";

describe("costPerPlayer", () => {
  it("divide el costo de la cancha por los titulares", () => {
    expect(costPerPlayer(50000, 10)).toBe(5000);
    expect(costPerPlayer(66000, 22)).toBe(3000);
  });

  it("redondea hacia arriba al peso para cubrir la cancha", () => {
    expect(costPerPlayer(50000, 12)).toBe(4167); // 4166,67
    expect(costPerPlayer(10001, 10)).toBe(1001); // 1000,1
    expect(costPerPlayer(0.3, 10)).toBe(1);
  });

  it("no introduce errores de punto flotante en divisiones exactas", () => {
    expect(costPerPlayer(33000, 11)).toBe(3000);
    expect(costPerPlayer(70000, 14)).toBe(5000);
    expect(costPerPlayer(0.1 + 0.2, 1)).toBe(1);
  });

  it("cancha gratis → $0", () => {
    expect(costPerPlayer(0, 10)).toBe(0);
  });

  it("datos inválidos → null", () => {
    expect(costPerPlayer(-1, 10)).toBeNull();
    expect(costPerPlayer(1000, 0)).toBeNull();
    expect(costPerPlayer(Number.NaN, 10)).toBeNull();
  });
});

describe("formatARS / parseARS", () => {
  it("formatea en pesos sin decimales", () => {
    expect(formatARS(25000).replace(/\s/g, " ")).toBe("$ 25.000");
  });

  it.each([
    ["50000", 50000],
    ["50.000", 50000],
    ["$ 1.250.000", 1250000],
    ["1.234,50", 1234.5],
    ["1234.5", 1234.5],
    ["0", 0],
  ])("parseARS(%j) = %d", (input, expected) => {
    expect(parseARS(input)).toBe(expected);
  });

  it.each(["", "abc", "-100", "1,2,3"])("parseARS(%j) = null", (input) => {
    expect(parseARS(input)).toBeNull();
  });
});
