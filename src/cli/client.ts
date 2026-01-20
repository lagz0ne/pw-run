// src/cli/client.ts
import { createConnection } from "net";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { getPaths } from "../utils/paths";
import type { WatchdogRequest, WatchdogResponse } from "../ipc/protocol";
import { encode, decode } from "../ipc/protocol";

export class Client {
  private async ensureWatchdog(): Promise<void> {
    const paths = getPaths();

    if (existsSync(paths.watchdogSocket)) {
      // Try to ping it
      try {
        await this.send({ type: "list" });
        return; // Watchdog is running
      } catch {
        // Socket exists but watchdog is dead
      }
    }

    // Start watchdog
    const proc = spawn(process.execPath, [process.argv[1], "--watchdog"], {
      detached: true,
      stdio: "ignore",
    });
    proc.unref();

    // Wait for watchdog to be ready
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        await this.send({ type: "list" });
        return;
      } catch {
        // Not ready yet
      }
    }

    throw new Error("Failed to start watchdog");
  }

  private send(req: WatchdogRequest): Promise<WatchdogResponse> {
    return new Promise((resolve, reject) => {
      const paths = getPaths();
      const socket = createConnection(paths.watchdogSocket);

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("Request timeout"));
      }, 10000);

      socket.on("connect", () => {
        socket.write(encode(req));
      });

      socket.on("data", (data) => {
        clearTimeout(timeout);
        socket.end();
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        resolve(decode<WatchdogResponse>(buf));
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async start(profile: string, session: string): Promise<WatchdogResponse> {
    await this.ensureWatchdog();
    return this.send({ type: "start", profile, session });
  }

  async stop(session: string): Promise<WatchdogResponse> {
    return this.send({ type: "stop", session });
  }

  async stopAll(): Promise<WatchdogResponse> {
    return this.send({ type: "stopAll" });
  }

  async list(): Promise<WatchdogResponse> {
    try {
      return await this.send({ type: "list" });
    } catch {
      // No watchdog running = no instances
      return { ok: true, instances: [] };
    }
  }

  async cdp(session?: string): Promise<WatchdogResponse> {
    return this.send({ type: "cdp", session });
  }
}
