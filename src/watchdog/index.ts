// src/watchdog/index.ts
import { createServer, createConnection, type Server, type Socket } from "net";
import { unlinkSync, readdirSync } from "fs";
import { getPaths } from "../utils/paths";
import { ProfileManager } from "../profile/manager";
import { Wrapper } from "../wrapper";
import { generateSessionName } from "../utils/names";
import type { WatchdogRequest, WatchdogResponse, InstanceInfo, WrapperResponse } from "../ipc/protocol";
import { encode, decode } from "../ipc/protocol";

export class Watchdog {
  private server: Server | null = null;
  private wrappers: Map<string, Wrapper> = new Map();
  private profileManager: ProfileManager;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const paths = getPaths();
    this.profileManager = new ProfileManager(paths.profiles);
  }

  async start(): Promise<void> {
    const paths = getPaths();

    // Clean up stale socket
    try { unlinkSync(paths.watchdogSocket); } catch {}

    // Discover existing wrappers
    await this.discoverExistingWrappers();

    // Start IPC server
    this.server = createServer((socket) => {
      this.handleConnection(socket);
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(paths.watchdogSocket, () => resolve());
    });

    // Start polling wrappers
    this.startPolling();
  }

  private async discoverExistingWrappers(): Promise<void> {
    const paths = getPaths();
    try {
      const files = readdirSync(paths.sockets);
      for (const file of files) {
        if (file === "watchdog.sock" || !file.endsWith(".sock")) continue;
        const session = file.replace(".sock", "");
        const socketPath = paths.sessionSocket(session);

        // Try to ping it
        try {
          const response = await this.pingWrapper(socketPath);
          if (response) {
            console.error(`Recovered session: ${session}`);
          }
        } catch {
          // Dead socket, clean up
          try { unlinkSync(socketPath); } catch {}
        }
      }
    } catch {
      // Sockets dir doesn't exist yet
    }
  }

  private async pingWrapper(socketPath: string): Promise<WrapperResponse | null> {
    return new Promise((resolve) => {
      const socket = createConnection(socketPath);
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(null);
      }, 1000);

      socket.on("connect", () => {
        socket.write(encode({ type: "ping" }));
      });

      socket.on("data", (data) => {
        clearTimeout(timeout);
        socket.end();
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        resolve(decode<WrapperResponse>(buf));
      });

      socket.on("error", () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  private startPolling(): void {
    this.pollInterval = setInterval(() => this.pollWrappers(), 5000);
  }

  private async pollWrappers(): Promise<void> {
    const paths = getPaths();

    for (const [session, wrapper] of this.wrappers) {
      if (!wrapper.isHealthy()) {
        console.error(`Session ${session} unhealthy, removing`);
        this.wrappers.delete(session);
        try { unlinkSync(paths.sessionSocket(session)); } catch {}
      }
    }

    // Check if we should exit (no wrappers left)
    if (this.wrappers.size === 0) {
      // Give a grace period before exiting
      setTimeout(() => {
        if (this.wrappers.size === 0) {
          this.stop();
          process.exit(0);
        }
      }, 5000);
    }
  }

  private handleConnection(socket: Socket): void {
    socket.on("data", async (data) => {
      try {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const req = decode<WatchdogRequest>(buf);
        const res = await this.handleRequest(req);
        socket.write(encode(res));
      } catch (err) {
        socket.write(encode({ ok: false, error: String(err) }));
      }
    });
  }

  private async handleRequest(req: WatchdogRequest): Promise<WatchdogResponse> {
    switch (req.type) {
      case "start":
        return this.handleStart(req.profile, req.session);

      case "stop":
        return this.handleStop(req.session);

      case "stopAll":
        return this.handleStopAll();

      case "list":
        return this.handleList();

      case "cdp":
        return this.handleCdp(req.session);

      default:
        return { ok: false, error: "Unknown request type" };
    }
  }

  private async handleStart(profileName: string, sessionName: string): Promise<WatchdogResponse> {
    const profile = await this.profileManager.get(profileName);
    if (!profile) {
      return { ok: false, error: `Profile '${profileName}' not found` };
    }

    const session = sessionName || generateSessionName();

    if (this.wrappers.has(session)) {
      return { ok: false, error: `Session '${session}' already exists` };
    }

    const wrapper = new Wrapper(session, profile);

    try {
      const cdpPort = await wrapper.start();
      this.wrappers.set(session, wrapper);
      return { ok: true, session, cdpPort };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  private async handleStop(session: string): Promise<WatchdogResponse> {
    const wrapper = this.wrappers.get(session);
    if (!wrapper) {
      return { ok: false, error: `Session '${session}' not found` };
    }

    await wrapper.stop();
    this.wrappers.delete(session);
    return { ok: true };
  }

  private async handleStopAll(): Promise<WatchdogResponse> {
    for (const [session, wrapper] of this.wrappers) {
      await wrapper.stop();
      this.wrappers.delete(session);
    }
    return { ok: true };
  }

  private async handleList(): Promise<WatchdogResponse> {
    const instances: InstanceInfo[] = [];
    const paths = getPaths();

    for (const [session] of this.wrappers) {
      const socketPath = paths.sessionSocket(session);
      const response = await this.pingWrapper(socketPath);

      if (response && response.type === "pong") {
        instances.push({
          session,
          profile: "default", // TODO: track profile name in wrapper
          cdpPort: response.cdpPort,
          lastUsed: response.lastUsed,
          lastPulse: new Date().toISOString(),
          status: response.status,
        });
      }
    }

    return { ok: true, instances };
  }

  private async handleCdp(session?: string): Promise<WatchdogResponse> {
    // If no session specified, use first available
    const targetSession = session || this.wrappers.keys().next().value;

    if (!targetSession) {
      return { ok: false, error: "No running sessions" };
    }

    const paths = getPaths();
    const socketPath = paths.sessionSocket(targetSession);
    const response = await this.pingWrapper(socketPath);

    if (response && response.type === "pong") {
      return { ok: true, cdpPort: response.cdpPort };
    }

    return { ok: false, error: `Session '${targetSession}' not responding` };
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    for (const [, wrapper] of this.wrappers) {
      await wrapper.stop();
    }

    if (this.server) {
      this.server.close();
      const paths = getPaths();
      try { unlinkSync(paths.watchdogSocket); } catch {}
    }
  }
}

// Entry point for watchdog mode
export async function runWatchdog(): Promise<void> {
  const watchdog = new Watchdog();

  process.on("SIGINT", async () => {
    await watchdog.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await watchdog.stop();
    process.exit(0);
  });

  await watchdog.start();
}
