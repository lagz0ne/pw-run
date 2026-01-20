import { describe, test, expect } from "bun:test";
import { generateSessionName, isValidSessionName } from "../../src/utils/names";

describe("generateSessionName", () => {
  test("returns adjective-noun format", () => {
    const name = generateSessionName();
    expect(name).toMatch(/^[a-z]+-[a-z]+$/);
  });

  test("generates unique names", () => {
    const names = new Set(Array.from({ length: 100 }, () => generateSessionName()));
    expect(names.size).toBeGreaterThanOrEqual(80);
  });
});

describe("isValidSessionName", () => {
  test("accepts valid names", () => {
    expect(isValidSessionName("happy-fox")).toBe(true);
    expect(isValidSessionName("my-session")).toBe(true);
    expect(isValidSessionName("test123")).toBe(true);
  });

  test("rejects invalid names", () => {
    expect(isValidSessionName("")).toBe(false);
    expect(isValidSessionName("has spaces")).toBe(false);
    expect(isValidSessionName("has/slash")).toBe(false);
    expect(isValidSessionName("a--b")).toBe(false);
  });
});
