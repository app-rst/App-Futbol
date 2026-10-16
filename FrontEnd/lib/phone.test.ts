import { describe, expect, it } from "vitest";
import { formatArPhone, normalizeArPhone } from "./phone";

describe("normalizeArPhone", () => {
  it.each([
    ["11 1234-5678", "+5491112345678"],
    ["1112345678", "+5491112345678"],
    ["011 15 1234 5678", "+5491112345678"],
    ["11 15 1234-5678", "+5491112345678"],
    ["+54 9 11 1234 5678", "+5491112345678"],
    ["+54 11 1234 5678", "+5491112345678"],
    ["0054 9 11 1234 5678", "+5491112345678"],
    ["351 15 123 4567", "+5493511234567"],
    ["2221 15 123456", "+5492221123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeArPhone(input)).toBe(expected);
  });

  it.each(["", "1234", "abc", "11 1234 567", "0000000000", "+1 555 123 4567"])("rechaza %j", (input) => {
    expect(normalizeArPhone(input)).toBeNull();
  });
});

describe("formatArPhone", () => {
  it("formatea AMBA y el interior", () => {
    expect(formatArPhone("+5491112345678")).toBe("+54 9 11 1234-5678");
    expect(formatArPhone("+5493511234567")).toBe("+54 9 351 123-4567");
  });
});
