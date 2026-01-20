// CLI → Watchdog messages
export type WatchdogRequest =
  | { type: "start"; profile: string; session: string }
  | { type: "stop"; session: string }
  | { type: "stopAll" }
  | { type: "list" }
  | { type: "cdp"; session?: string };

// Watchdog → CLI responses
export type WatchdogResponse =
  | { ok: true; session: string; cdpPort: number }
  | { ok: true; instances: InstanceInfo[] }
  | { ok: true; cdpPort: number }
  | { ok: true }
  | { ok: false; error: string };

// Watchdog ↔ Wrapper messages
export type WrapperRequest =
  | { type: "ping" }
  | { type: "shutdown" };

export type WrapperResponse =
  | { type: "pong"; cdpPort: number; status: "healthy" | "unhealthy"; lastUsed: string }
  | { type: "shutdownAck" };

// Instance info for list command
export interface InstanceInfo {
  session: string;
  profile: string;
  cdpPort: number;
  lastUsed: string;
  lastPulse: string;
  status: "healthy" | "unhealthy";
}

// Serialize/deserialize helpers
export function encode(msg: unknown): Buffer {
  return Buffer.from(JSON.stringify(msg) + "\n");
}

export function decode<T>(data: Buffer): T {
  return JSON.parse(data.toString().trim());
}
