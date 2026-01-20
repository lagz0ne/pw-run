// src/wrapper/index.ts
import { chromium, firefox, webkit, type Browser, type BrowserContext } from "playwright-core";
import { createServer, type Server } from "net";
import { unlinkSync } from "fs";
import type { Profile } from "../profile/schema";
import type { WrapperRequest, WrapperResponse } from "../ipc/protocol";
import { encode, decode } from "../ipc/protocol";
import { getPaths } from "../utils/paths";
import { discoverBrowser } from "../browser/discovery";

// Find an available port
async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export class Wrapper {
  public readonly session: string;
  private profile: Profile;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private cdpPort: number = 0;
  private server: Server | null = null;
  private lastUsed: Date = new Date();

  constructor(session: string, profile: Profile) {
    this.session = session;
    this.profile = profile;
  }

  async start(): Promise<number> {
    const browserType = this.profile.browser || "chromium";
    const launcher = { chromium, firefox, webkit }[browserType];

    if (!launcher) {
      throw new Error(`Unknown browser type: ${browserType}`);
    }

    const executablePath = this.profile.executable || await discoverBrowser(browserType);
    if (!executablePath) {
      throw new Error(`Could not find ${browserType} browser. Install via: npx playwright install ${browserType}`);
    }

    // Find an available port for CDP
    this.cdpPort = await findAvailablePort();

    // Launch with specific CDP port
    this.browser = await launcher.launch({
      headless: this.profile.headless ?? true,
      executablePath,
      args: [
        ...(this.profile.args || []),
        `--remote-debugging-port=${this.cdpPort}`,
      ],
    });

    // Create a new context with profile settings
    this.context = await this.browser.newContext({
      viewport: this.profile.viewport,
      locale: this.profile.locale,
      timezoneId: this.profile.timezone,
      colorScheme: this.profile.colorScheme,
      userAgent: this.profile.userAgent,
      ignoreHTTPSErrors: this.profile.ignoreHTTPSErrors,
      offline: this.profile.offline,
    });

    // Create initial blank page for CDP clients
    await this.context.newPage();

    // Start IPC server
    await this.startIpcServer();

    return this.cdpPort;
  }

  private async startIpcServer(): Promise<void> {
    const socketPath = getPaths().sessionSocket(this.session);

    // Clean up stale socket
    try { unlinkSync(socketPath); } catch {}

    this.server = createServer((socket) => {
      socket.on("data", async (data) => {
        try {
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          const req = decode<WrapperRequest>(buf);
          const res = await this.handleRequest(req);
          socket.write(encode(res));
        } catch (err) {
          socket.write(encode({ type: "error", message: String(err) }));
        }
      });
    });

    return new Promise((resolve) => {
      this.server!.listen(socketPath, () => resolve());
    });
  }

  private async handleRequest(req: WrapperRequest): Promise<WrapperResponse> {
    switch (req.type) {
      case "ping":
        this.lastUsed = new Date();
        return {
          type: "pong",
          cdpPort: this.cdpPort,
          status: this.browser?.isConnected() ? "healthy" : "unhealthy",
          lastUsed: this.lastUsed.toISOString(),
        };

      case "shutdown":
        await this.stop();
        return { type: "shutdownAck" };

      default:
        throw new Error(`Unknown request type`);
    }
  }

  async stop(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    if (this.server) {
      this.server.close();
      const socketPath = getPaths().sessionSocket(this.session);
      try { unlinkSync(socketPath); } catch {}
    }
  }

  isHealthy(): boolean {
    return this.browser?.isConnected() ?? false;
  }
}
