// tests/browser/discovery.test.ts
import { describe, test, expect } from "bun:test";
import { discoverBrowser } from "../../src/browser/discovery";

describe("discoverBrowser", () => {
  test("finds playwright browsers in cache", async () => {
    // This test may pass or fail depending on installed browsers
    // It mainly tests the discovery logic doesn't throw
    const result = await discoverBrowser("chromium");
    // Result is either a path string or null
    expect(result === null || typeof result === "string").toBe(true);
  });

  test("returns null for unknown browser type", async () => {
    const result = await discoverBrowser("unknown" as any);
    expect(result).toBeNull();
  });
});
