// tests/wrapper/wrapper.test.ts
import { describe, test, expect } from "bun:test";
import { Wrapper } from "../../src/wrapper";
import type { Profile } from "../../src/profile/schema";

describe("Wrapper", () => {
  test("can be instantiated with profile", () => {
    const profile: Profile = { browser: "chromium", headless: true };
    const wrapper = new Wrapper("test-session", profile);
    expect(wrapper.session).toBe("test-session");
  });
});
