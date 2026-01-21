import { parse, stringify } from "yaml";
import { join } from "path";
import { readFile, writeFile, unlink, readdir, access } from "fs/promises";
import type { Profile } from "./schema";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export class ProfileManager {
  constructor(private profilesDir: string) {}

  async create(name: string, profile: Profile): Promise<void> {
    const path = this.path(name);
    await writeFile(path, stringify(profile), "utf-8");
  }

  async get(name: string): Promise<Profile | null> {
    const path = this.path(name);
    if (!(await fileExists(path))) return null;
    const content = await readFile(path, "utf-8");
    return parse(content) as Profile;
  }

  async set(name: string, updates: Partial<Profile>): Promise<void> {
    const existing = await this.get(name);
    if (!existing) throw new Error(`Profile '${name}' not found`);
    const merged = { ...existing, ...updates };
    await writeFile(this.path(name), stringify(merged), "utf-8");
  }

  async append(name: string, key: "args", values: string[]): Promise<void> {
    const existing = await this.get(name);
    if (!existing) throw new Error(`Profile '${name}' not found`);
    const current = existing[key] || [];
    existing[key] = [...current, ...values];
    await writeFile(this.path(name), stringify(existing), "utf-8");
  }

  async unset(name: string, keys: (keyof Profile)[]): Promise<void> {
    const existing = await this.get(name);
    if (!existing) throw new Error(`Profile '${name}' not found`);
    for (const key of keys) {
      delete existing[key];
    }
    await writeFile(this.path(name), stringify(existing), "utf-8");
  }

  async remove(name: string): Promise<void> {
    const path = this.path(name);
    if (await fileExists(path)) {
      await unlink(path);
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await readdir(this.profilesDir);
      return files
        .filter((f) => f.endsWith(".yaml"))
        .map((f) => f.replace(".yaml", ""));
    } catch {
      return [];
    }
  }

  private path(name: string): string {
    return join(this.profilesDir, `${name}.yaml`);
  }
}
