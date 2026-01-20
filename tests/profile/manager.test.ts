import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ProfileManager } from "../../src/profile/manager";
import { rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("ProfileManager", () => {
  let testDir: string;
  let manager: ProfileManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `bwsr-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    manager = new ProfileManager(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("create and get profile", async () => {
    await manager.create("test", { browser: "chromium", headless: true });
    const profile = await manager.get("test");
    expect(profile?.browser).toBe("chromium");
    expect(profile?.headless).toBe(true);
  });

  test("list profiles", async () => {
    await manager.create("one", { browser: "chromium" });
    await manager.create("two", { browser: "firefox" });
    const list = await manager.list();
    expect(list).toContain("one");
    expect(list).toContain("two");
  });

  test("set updates profile", async () => {
    await manager.create("test", { headless: true });
    await manager.set("test", { headless: false, locale: "en-US" });
    const profile = await manager.get("test");
    expect(profile?.headless).toBe(false);
    expect(profile?.locale).toBe("en-US");
  });

  test("remove deletes profile", async () => {
    await manager.create("test", { browser: "chromium" });
    await manager.remove("test");
    const profile = await manager.get("test");
    expect(profile).toBeNull();
  });

  test("get returns null for missing profile", async () => {
    const profile = await manager.get("nonexistent");
    expect(profile).toBeNull();
  });
});
