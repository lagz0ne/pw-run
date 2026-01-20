// src/cli/commands.ts
import { Client } from "./client";
import { ProfileManager } from "../profile/manager";
import { getPaths, ensureDirectories } from "../utils/paths";
import type { Profile } from "../profile/schema";

const client = new Client();

export async function cmdStart(options: {
  profile?: string;
  session?: string;
  verbose?: boolean;
}): Promise<void> {
  await ensureDirectories();

  const profile = options.profile || "default";
  const session = options.session || "";

  const res = await client.start(profile, session);

  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }

  if (options.verbose && "session" in res) {
    console.log(`Session: ${res.session}`);
    console.log(`CDP: ${res.cdpPort}`);
    console.log(`Profile: ${profile}`);
  } else if ("session" in res) {
    console.log(res.session);
  }
}

export async function cmdStop(session: string): Promise<void> {
  const res = await client.stop(session);
  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }
}

export async function cmdStopAll(): Promise<void> {
  const res = await client.stopAll();
  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }
}

export async function cmdList(): Promise<void> {
  const res = await client.list();

  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }

  if ("instances" in res && res.instances.length === 0) {
    return; // Silent when no instances
  }

  if ("instances" in res) {
    for (const inst of res.instances) {
      console.log(`${inst.session}\t${inst.profile}\t${inst.cdpPort}\t${inst.status}`);
    }
  }
}

export async function cmdCdp(session?: string): Promise<void> {
  const res = await client.cdp(session);

  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }

  if ("cdpPort" in res) {
    console.log(res.cdpPort);
  }
}

export async function cmdProfileCreate(name: string): Promise<void> {
  await ensureDirectories();
  const paths = getPaths();
  const manager = new ProfileManager(paths.profiles);

  const existing = await manager.get(name);
  if (existing) {
    console.error(`Profile '${name}' already exists`);
    process.exit(1);
  }

  await manager.create(name, { browser: "chromium", headless: true });
}

export async function cmdProfileSet(name: string, updates: Partial<Profile>): Promise<void> {
  const paths = getPaths();
  const manager = new ProfileManager(paths.profiles);

  try {
    await manager.set(name, updates);
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }
}

export async function cmdProfileRemove(name: string): Promise<void> {
  const paths = getPaths();
  const manager = new ProfileManager(paths.profiles);
  await manager.remove(name);
}

export async function cmdProfileList(): Promise<void> {
  const paths = getPaths();
  const manager = new ProfileManager(paths.profiles);
  const profiles = await manager.list();

  for (const p of profiles) {
    console.log(p);
  }
}

export async function cmdProfileShow(name: string): Promise<void> {
  const paths = getPaths();
  const manager = new ProfileManager(paths.profiles);
  const profile = await manager.get(name);

  if (!profile) {
    console.error(`Profile '${name}' not found`);
    process.exit(1);
  }

  const { stringify } = await import("yaml");
  console.log(stringify(profile));
}

// Supported playwright-core versions (major.minor)
const SUPPORTED_PLAYWRIGHT_VERSIONS = ["1.40", "1.41", "1.42", "1.43", "1.44", "1.45", "1.46", "1.47", "1.48", "1.49", "1.50", "1.51", "1.52", "1.53", "1.54", "1.55", "1.56", "1.57"];

function checkVersion(version: string): { supported: boolean; message: string } {
  const match = version.match(/^(\d+)\.(\d+)/);
  if (!match) return { supported: false, message: "unknown version format" };

  const majorMinor = `${match[1]}.${match[2]}`;
  const major = parseInt(match[1]);

  if (major < 1) {
    return { supported: false, message: "version too old" };
  }

  if (SUPPORTED_PLAYWRIGHT_VERSIONS.includes(majorMinor)) {
    return { supported: true, message: "supported" };
  }

  // Allow newer versions with a warning
  if (major >= 1 && parseInt(match[2]) > 57) {
    return { supported: true, message: "newer than tested, should work" };
  }

  return { supported: false, message: "version not in supported range (1.40+)" };
}

export async function cmdDoctor(): Promise<void> {
  const paths = getPaths();
  let hasIssues = false;

  console.log("bwsr doctor\n");
  console.log("=".repeat(50));

  // 1. Check playwright-core
  console.log("\n[Runtime]");
  let playwrightVersion: string | null = null;

  try {
    await import("playwright-core");
    // Try to get version from package
    try {
      const pkgPath = require.resolve("playwright-core/package.json");
      const pkg = await Bun.file(pkgPath).json();
      playwrightVersion = pkg.version;
    } catch {
      playwrightVersion = "installed (version unknown)";
    }
  } catch {
    playwrightVersion = null;
  }

  if (playwrightVersion) {
    const versionCheck = typeof playwrightVersion === "string" && playwrightVersion.match(/^\d/)
      ? checkVersion(playwrightVersion)
      : { supported: true, message: "" };

    const status = versionCheck.supported ? "✓" : "✗";
    const extra = versionCheck.message && versionCheck.message !== "supported"
      ? ` (${versionCheck.message})`
      : "";
    console.log(`  ${status} playwright-core: ${playwrightVersion}${extra}`);

    if (!versionCheck.supported) hasIssues = true;
  } else {
    console.log("  ✗ playwright-core: not found");
    hasIssues = true;
  }

  // 2. Check directories
  console.log("\n[Configuration]");
  console.log(`  Config dir: ${paths.root}`);
  console.log(`  Profiles:   ${paths.profiles}`);
  console.log(`  Sockets:    ${paths.sockets}`);

  // 3. Check for browsers
  console.log("\n[Browsers]");
  const { discoverBrowser } = await import("../browser/discovery");

  let browsersFound = 0;
  for (const browser of ["chromium", "firefox", "webkit"] as const) {
    const path = await discoverBrowser(browser);
    if (path) {
      console.log(`  ✓ ${browser}: ${path}`);
      browsersFound++;
    } else {
      console.log(`  - ${browser}: not found`);
    }
  }

  if (browsersFound === 0) {
    hasIssues = true;
  }

  // 4. Check running instances
  console.log("\n[Status]");
  try {
    const res = await client.list();
    if ("instances" in res) {
      console.log(`  Running instances: ${res.instances.length}`);
    }
  } catch {
    console.log("  Watchdog: not running");
  }

  // 5. Suggestions
  if (hasIssues) {
    console.log("\n" + "=".repeat(50));
    console.log("[Suggestions]\n");

    if (!playwrightVersion) {
      console.log("  Install playwright-core:");
      console.log("    npm install playwright-core");
      console.log("    # or");
      console.log("    bun add playwright-core\n");
    }

    if (browsersFound === 0) {
      console.log("  Install browsers:");
      console.log("    npx playwright install chromium");
      console.log("    # or for all browsers:");
      console.log("    npx playwright install\n");
    }
  } else {
    console.log("\n" + "=".repeat(50));
    console.log("\n✓ All checks passed. Ready to use bwsr.\n");
  }
}
