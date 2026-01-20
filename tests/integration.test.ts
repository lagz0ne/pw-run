// tests/integration.test.ts
import { describe, test, expect, afterAll } from "bun:test";
import { $ } from "bun";

describe("bwsr integration", () => {
  afterAll(async () => {
    // Cleanup
    await $`bun run src/index.ts stop --all`.quiet().nothrow();
  });

  test("profile create and list", async () => {
    // Clean up any existing test profile
    await $`bun run src/index.ts profile remove test-profile`.quiet().nothrow();

    await $`bun run src/index.ts profile create test-profile`.quiet();
    const { stdout } = await $`bun run src/index.ts profile list`.quiet();
    expect(stdout.toString()).toContain("test-profile");
    await $`bun run src/index.ts profile remove test-profile`.quiet();
  });

  test("profile set and show", async () => {
    await $`bun run src/index.ts profile create test-set`.quiet().nothrow();
    await $`bun run src/index.ts profile set test-set --browser chromium --headless`.quiet();
    const { stdout } = await $`bun run src/index.ts profile show test-set`.quiet();
    expect(stdout.toString()).toContain("chromium");
    expect(stdout.toString()).toContain("headless");
    await $`bun run src/index.ts profile remove test-set`.quiet();
  });

  test("doctor command runs", async () => {
    const { stdout } = await $`bun run src/index.ts doctor`.quiet();
    expect(stdout.toString()).toContain("Config dir:");
    expect(stdout.toString()).toContain("Browsers:");
  });

  test("help shows usage", async () => {
    const { stdout } = await $`bun run src/index.ts`.quiet();
    expect(stdout.toString()).toContain("Usage:");
    expect(stdout.toString()).toContain("Commands:");
  });

  test("list with no instances", async () => {
    // Should not error, just silent output
    const result = await $`bun run src/index.ts list`.quiet().nothrow();
    expect(result.exitCode).toBe(0);
  });
});
