import { parse, stringify } from "yaml";
import { join } from "path";
import type { Profile } from "./schema";

export class ProfileManager {
  constructor(private profilesDir: string) {}

  async create(name: string, profile: Profile): Promise<void> {
    const path = this.path(name);
    await Bun.write(path, stringify(profile));
  }

  async get(name: string): Promise<Profile | null> {
    const path = this.path(name);
    const file = Bun.file(path);
    if (!(await file.exists())) return null;
    const content = await file.text();
    return parse(content) as Profile;
  }

  async set(name: string, updates: Partial<Profile>): Promise<void> {
    const existing = await this.get(name);
    if (!existing) throw new Error(`Profile '${name}' not found`);
    const merged = { ...existing, ...updates };
    await Bun.write(this.path(name), stringify(merged));
  }

  async append(name: string, key: "args", values: string[]): Promise<void> {
    const existing = await this.get(name);
    if (!existing) throw new Error(`Profile '${name}' not found`);
    const current = existing[key] || [];
    existing[key] = [...current, ...values];
    await Bun.write(this.path(name), stringify(existing));
  }

  async unset(name: string, keys: (keyof Profile)[]): Promise<void> {
    const existing = await this.get(name);
    if (!existing) throw new Error(`Profile '${name}' not found`);
    for (const key of keys) {
      delete existing[key];
    }
    await Bun.write(this.path(name), stringify(existing));
  }

  async remove(name: string): Promise<void> {
    const path = this.path(name);
    const file = Bun.file(path);
    if (await file.exists()) {
      const { unlink } = await import("fs/promises");
      await unlink(path);
    }
  }

  async list(): Promise<string[]> {
    const { readdir } = await import("fs/promises");
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
