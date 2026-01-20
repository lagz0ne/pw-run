// tests/utils/paths.test.ts
import { describe, test, expect } from "bun:test";
import { getPaths } from "../../src/utils/paths";

describe("getPaths", () => {
  test("returns expected directory structure", () => {
    const paths = getPaths();

    expect(paths.root).toContain(".bwsr");
    expect(paths.profiles).toContain("profiles");
    expect(paths.sockets).toContain("sockets");
    expect(paths.watchdogSocket).toContain("watchdog.sock");
  });

  test("profile path includes name", () => {
    const paths = getPaths();
    expect(paths.profile("default")).toContain("default.yaml");
  });

  test("session socket path includes name", () => {
    const paths = getPaths();
    expect(paths.sessionSocket("happy-fox")).toContain("happy-fox.sock");
  });
});
