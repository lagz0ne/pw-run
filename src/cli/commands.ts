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

export async function cmdDoctor(): Promise<void> {
  const paths = getPaths();

  console.log("Checking bwsr installation...\n");

  console.log(`Config dir: ${paths.root}`);
  console.log(`Profiles: ${paths.profiles}`);
  console.log(`Sockets: ${paths.sockets}`);

  // Check for browsers
  const { discoverBrowser } = await import("../browser/discovery");

  console.log("\nBrowsers:");
  for (const browser of ["chromium", "firefox", "webkit"] as const) {
    const path = await discoverBrowser(browser);
    console.log(`  ${browser}: ${path || "not found"}`);
  }

  // Check running instances
  const res = await client.list();
  if ("instances" in res) {
    console.log(`\nRunning instances: ${res.instances.length}`);
  }
}
