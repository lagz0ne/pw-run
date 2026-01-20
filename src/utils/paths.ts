// src/utils/paths.ts
import { homedir } from "os";
import { join } from "path";

export interface BwsrPaths {
  root: string;
  profiles: string;
  sockets: string;
  watchdogSocket: string;
  profile: (name: string) => string;
  sessionSocket: (session: string) => string;
}

export function getPaths(): BwsrPaths {
  const root = join(homedir(), ".bwsr");
  const profiles = join(root, "profiles");
  const sockets = join(root, "sockets");

  return {
    root,
    profiles,
    sockets,
    watchdogSocket: join(sockets, "watchdog.sock"),
    profile: (name: string) => join(profiles, `${name}.yaml`),
    sessionSocket: (session: string) => join(sockets, `${session}.sock`),
  };
}

export async function ensureDirectories(): Promise<void> {
  const paths = getPaths();
  await Bun.write(paths.profiles + "/.keep", "");
  await Bun.write(paths.sockets + "/.keep", "");
}
