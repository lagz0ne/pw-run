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
  force?: boolean;
}): Promise<void> {
  await ensureDirectories();

  const profileName = options.profile || "default";
  const explicitSession = options.session || "";

  // If no explicit session requested, check if one is already running
  if (!explicitSession && !options.force) {
    const listRes = await client.list();
    if (listRes.ok && "instances" in listRes && listRes.instances.length > 0) {
      const inst = listRes.instances[0];
      if (options.verbose) {
        console.log(`Session: ${inst.session}`);
        console.log(`CDP: ${inst.cdpPort}`);
        console.log(`Profile: ${inst.profile}`);
        console.log(`(already running, use --force to start another)`);
      } else {
        console.log(inst.session);
      }
      return;
    }
  }

  // Auto-create default profile if it doesn't exist
  const paths = getPaths();
  const manager = new ProfileManager(paths.profiles);
  const existingProfile = await manager.get(profileName);

  if (!existingProfile) {
    if (profileName === "default") {
      await manager.create("default", { browser: "chromium", headless: true });
      console.log("Created default profile (chromium, headless)");
    } else {
      console.error(`Profile '${profileName}' not found. Create it with: bwsr profile create ${profileName}`);
      process.exit(1);
    }
  }

  const res = await client.start(profileName, explicitSession);

  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }

  if (options.verbose && "session" in res) {
    console.log(`Session: ${res.session}`);
    console.log(`CDP: ${res.cdpPort}`);
    console.log(`Profile: ${profileName}`);
  } else if ("session" in res) {
    console.log(res.session);
  }
}

export async function cmdStop(session?: string): Promise<void> {
  // If no session specified, try to be smart
  if (!session) {
    const listRes = await client.list();
    if (!listRes.ok || !("instances" in listRes)) {
      console.error("No sessions running");
      process.exit(1);
    }

    const instances = listRes.instances;
    if (instances.length === 0) {
      console.error("No sessions running");
      process.exit(1);
    }

    if (instances.length === 1) {
      // Only one session, stop it
      session = instances[0].session;
    } else {
      // Multiple sessions, show list
      console.error("Multiple sessions running. Specify which to stop:");
      for (const inst of instances) {
        console.error(`  bwsr stop ${inst.session}`);
      }
      console.error(`  bwsr stop --all`);
      process.exit(1);
    }
  }

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
  await ensureDirectories();
  const paths = getPaths();
  let hasIssues = false;
  const suggestions: string[] = [];

  console.log("bwsr doctor\n");
  console.log("=".repeat(50));

  // 1. Check Node.js version
  console.log("\n[Runtime]");
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0]);
  if (nodeMajor >= 18) {
    console.log(`  ✓ Node.js: ${nodeVersion}`);
  } else {
    console.log(`  ✗ Node.js: ${nodeVersion} (requires >=18.0.0)`);
    hasIssues = true;
    suggestions.push("Upgrade Node.js to version 18 or later");
  }

  // 2. Check playwright-core
  let playwrightVersion: string | null = null;

  try {
    await import("playwright-core");
    // Try to get version from package
    try {
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      const pkgPath = require.resolve("playwright-core/package.json");
      const { readFile } = await import("fs/promises");
      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
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
    suggestions.push("Install playwright-core:\n    npm install -g playwright-core\n    # or add to your project:\n    npm install playwright-core");
  }

  // 3. Check directories and profiles (auto-fix missing default)
  console.log("\n[Configuration]");
  console.log(`  Config dir: ${paths.root}`);

  const manager = new ProfileManager(paths.profiles);
  let profiles = await manager.list();

  if (profiles.length === 0) {
    // Auto-create default profile
    await manager.create("default", { browser: "chromium", headless: true });
    profiles = ["default"];
    console.log(`  ✓ Profiles: default (created)`);
  } else {
    console.log(`  ✓ Profiles: ${profiles.join(", ")}`);
  }

  // 4. Check for browsers
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
    suggestions.push("Install browsers:\n    npx playwright install chromium\n    # or for all browsers:\n    npx playwright install");
  }

  // 5. Check running instances
  console.log("\n[Status]");
  try {
    const res = await client.list();
    if ("instances" in res) {
      console.log(`  Running instances: ${res.instances.length}`);
    }
  } catch {
    console.log("  Watchdog: not running (starts automatically on 'bwsr start')");
  }

  // 6. Suggestions
  console.log("\n" + "=".repeat(50));

  if (hasIssues && suggestions.length > 0) {
    console.log("\n[Setup Required]\n");
    for (const suggestion of suggestions) {
      console.log(`  ${suggestion}\n`);
    }
  } else if (hasIssues) {
    console.log("\nSome checks failed. Review the output above.\n");
  } else {
    console.log("\n✓ All checks passed. Ready to use bwsr.\n");
    console.log("Quick start:");
    console.log("  bwsr start           # Start browser daemon");
    console.log("  bwsr cdp             # Get CDP endpoint");
    console.log("  bwsr stop --all      # Stop all sessions\n");
  }
}
