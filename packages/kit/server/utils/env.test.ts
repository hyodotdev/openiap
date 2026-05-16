import { describe, expect, test } from "vitest";

import { parsePort, parsePositiveNumber } from "./env";

describe("parsePositiveNumber", () => {
  test("falls back for undefined / empty string", () => {
    expect(parsePositiveNumber(undefined, 60, 1)).toBe(60);
    expect(parsePositiveNumber("", 60, 1)).toBe(60);
  });

  test("falls back for NaN / Infinity / non-numeric", () => {
    expect(parsePositiveNumber("pineapple", 60, 1)).toBe(60);
    expect(parsePositiveNumber("120ms", 60, 1)).toBe(60);
    expect(parsePositiveNumber("0x10", 60, 1)).toBe(60);
    expect(parsePositiveNumber("1e2", 60, 1)).toBe(60);
    expect(parsePositiveNumber("+1", 60, 1)).toBe(60);
    expect(parsePositiveNumber("NaN", 60, 1)).toBe(60);
    expect(parsePositiveNumber("Infinity", 60, 1)).toBe(60);
  });

  test("enforces the min argument", () => {
    expect(parsePositiveNumber("0", 60, 1)).toBe(60);
    expect(parsePositiveNumber("-5", 60, 1)).toBe(60);
    expect(parsePositiveNumber("0.5", 60, 1)).toBe(60);
    expect(parsePositiveNumber("0.5", 60, 0.001)).toBe(0.5);
  });

  test("returns the parsed value when finite and at-or-above min", () => {
    expect(parsePositiveNumber("120", 60, 1)).toBe(120);
    expect(parsePositiveNumber(" 120 ", 60, 1)).toBe(120);
    expect(parsePositiveNumber("1", 60, 1)).toBe(1);
  });
});

describe("parsePort", () => {
  test("falls back for undefined / empty", () => {
    expect(parsePort(undefined, 3000)).toBe(3000);
    expect(parsePort("", 3000)).toBe(3000);
  });

  test("falls back for non-numeric or fractional values", () => {
    expect(parsePort("banana", 3000)).toBe(3000);
    expect(parsePort("3000abc", 3000)).toBe(3000);
    expect(parsePort("8080.5", 3000)).toBe(3000);
    expect(parsePort("NaN", 3000)).toBe(3000);
  });

  test("falls back for out-of-range TCP ports", () => {
    expect(parsePort("0", 3000)).toBe(3000);
    expect(parsePort("-1", 3000)).toBe(3000);
    expect(parsePort("65536", 3000)).toBe(3000);
    expect(parsePort("99999", 3000)).toBe(3000);
  });

  test("returns the parsed value for 1..65535", () => {
    expect(parsePort("1", 3000)).toBe(1);
    expect(parsePort(" 3000 ", 8080)).toBe(3000);
    expect(parsePort("3000", 3000)).toBe(3000);
    expect(parsePort("8080", 3000)).toBe(8080);
    expect(parsePort("65535", 3000)).toBe(65_535);
  });
});
