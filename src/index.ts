// src/index.ts
import { runWatchdog } from "./watchdog";
import {
  cmdStart,
  cmdStop,
  cmdStopAll,
  cmdList,
  cmdCdp,
  cmdProfileCreate,
  cmdProfileSet,
  cmdProfileRemove,
  cmdProfileList,
  cmdProfileShow,
  cmdDoctor,
} from "./cli/commands";

const args = process.argv.slice(2);

function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const command = args[0];
  const flags = parseFlags(args);

  // Watchdog mode (internal)
  if (flags.watchdog) {
    await runWatchdog();
    return;
  }

  switch (command) {
    case "start":
      await cmdStart({
        profile: flags.profile as string | undefined,
        session: flags.session as string | undefined,
        verbose: Boolean(flags.verbose),
      });
      break;

    case "stop":
      if (flags.all) {
        await cmdStopAll();
      } else {
        const session = args[1];
        if (!session) {
          console.error("Usage: bwsr stop <session> | --all");
          process.exit(1);
        }
        await cmdStop(session);
      }
      break;

    case "list":
      await cmdList();
      break;

    case "cdp":
      await cmdCdp(args[1]);
      break;

    case "profile":
      await handleProfileCommand(args.slice(1), flags);
      break;

    case "doctor":
      await cmdDoctor();
      break;

    default:
      printHelp();
      break;
  }
}

async function handleProfileCommand(
  args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "create":
      await cmdProfileCreate(args[1]);
      break;

    case "set": {
      const updates: Record<string, unknown> = {};
      if (flags.browser) updates.browser = flags.browser;
      if (flags.executable) updates.executable = flags.executable;
      if (flags.headless !== undefined) updates.headless = flags.headless === true || flags.headless === "true";
      if (flags.headed !== undefined) updates.headless = false;
      if (flags.locale) updates.locale = flags.locale;
      if (flags.timezone) updates.timezone = flags.timezone;
      if (flags.viewport) {
        const [w, h] = (flags.viewport as string).split("x").map(Number);
        updates.viewport = { width: w, height: h };
      }
      await cmdProfileSet(args[1], updates);
      break;
    }

    case "remove":
      await cmdProfileRemove(args[1]);
      break;

    case "list":
      await cmdProfileList();
      break;

    case "show":
      await cmdProfileShow(args[1]);
      break;

    default:
      console.error("Usage: bwsr profile <create|set|remove|list|show> [name] [flags]");
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`bwsr - Browser daemon manager

Usage: bwsr <command> [options]

Commands:
  start [--profile name] [--session name] [--verbose]
  stop <session> | --all
  list
  cdp [session]
  profile <create|set|remove|list|show> [name] [flags]
  doctor

Examples:
  bwsr profile create default
  bwsr profile set default --browser chromium --headless
  bwsr start
  bwsr cdp
  agent-browser --cdp $(bwsr cdp) snapshot
  bwsr stop --all`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
