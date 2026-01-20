// src/browser/discovery.ts
import { homedir } from "os";
import { join } from "path";
import { readdir, stat } from "fs/promises";

type BrowserType = "chromium" | "firefox" | "webkit";

interface BrowserPaths {
  chromium: string[];
  firefox: string[];
  webkit: string[];
}

const playwrightCache = join(homedir(), ".cache", "ms-playwright");

const systemPaths: BrowserPaths = {
  chromium: [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  firefox: [
    "/usr/bin/firefox",
    "/Applications/Firefox.app/Contents/MacOS/firefox",
  ],
  webkit: [], // WebKit typically only via Playwright
};

const playwrightExecutables: Record<BrowserType, string> = {
  chromium: process.platform === "darwin"
    ? "chrome-mac/Chromium.app/Contents/MacOS/Chromium"
    : "chrome-linux/chrome",
  firefox: process.platform === "darwin"
    ? "firefox/Nightly.app/Contents/MacOS/firefox"
    : "firefox/firefox",
  webkit: process.platform === "darwin"
    ? "pw_run.app/Contents/MacOS/pw_run"
    : "playwright-webkit/pw_run.sh",
};

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findLatestPlaywrightBrowser(browser: BrowserType): Promise<string | null> {
  try {
    const entries = await readdir(playwrightCache);
    const matching = entries
      .filter((e) => e.startsWith(browser + "-"))
      .sort()
      .reverse(); // Latest version first

    for (const dir of matching) {
      const execPath = join(playwrightCache, dir, playwrightExecutables[browser]);
      if (await exists(execPath)) {
        return execPath;
      }
    }
  } catch {
    // Cache dir doesn't exist
  }
  return null;
}

async function findSystemBrowser(browser: BrowserType): Promise<string | null> {
  for (const path of systemPaths[browser]) {
    if (await exists(path)) {
      return path;
    }
  }
  return null;
}

export async function discoverBrowser(browser: BrowserType): Promise<string | null> {
  if (!["chromium", "firefox", "webkit"].includes(browser)) {
    return null;
  }

  // Try Playwright cache (preferred - known good version)
  const playwrightPath = await findLatestPlaywrightBrowser(browser);
  if (playwrightPath) return playwrightPath;

  // Fall back to system browser
  const systemPath = await findSystemBrowser(browser);
  if (systemPath) return systemPath;

  return null;
}
