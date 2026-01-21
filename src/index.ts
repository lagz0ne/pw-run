#!/usr/bin/env node
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

const VERSION = "0.3.0";
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
        force: Boolean(flags.force),
      });
      break;

    case "stop":
      if (flags.all) {
        await cmdStopAll();
      } else {
        await cmdStop(args[1]); // undefined if not provided, cmdStop handles it
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

    case "--version":
    case "-v":
    case "version":
      console.log(`bwsr v${VERSION}`);
      break;

    case "--help":
    case "-h":
    case "help":
      await printHelp();
      break;

    default:
      await printHelp();
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

async function printHelp(): Promise<void> {
  const { getPaths } = await import("./utils/paths");
  const { ProfileManager } = await import("./profile/manager");

  const paths = getPaths();
  const manager = new ProfileManager(paths.profiles);
  const profiles = await manager.list();
  const isFirstTime = profiles.length === 0;

  console.log(`bwsr v${VERSION} - Browser daemon manager

Usage: bwsr <command> [options]

Commands:
  start                   Start or reuse existing session
    --profile <name>      Use specific profile (default: "default")
    --session <name>      Named session (starts new)
    --force               Start new session even if one exists
    --verbose             Show connection details
  stop [session]          Stop session (auto-selects if only one)
  stop --all              Stop all sessions
  list                    List running sessions
  cdp [session]           Get CDP endpoint URL
  profile                 Manage browser profiles
    create <name>         Create new profile
    set <name> [flags]    Update profile settings
    remove <name>         Delete profile
    list                  List all profiles
    show <name>           Show profile details
  doctor                  Check system health and dependencies
  version                 Show version`);

  if (isFirstTime) {
    console.log(`
${"=".repeat(50)}
Quick Start:

  1. Start a browser session:
     $ bwsr start

  2. Get CDP endpoint for your tools:
     $ bwsr cdp

  3. Stop when done:
     $ bwsr stop

Run 'bwsr doctor' to verify dependencies are installed.
${"=".repeat(50)}`);
  } else {
    console.log(`
Examples:
  bwsr start                     # Start or reuse existing session
  bwsr cdp                       # Get CDP URL
  bwsr stop                      # Stop the session
  bwsr profile set default --headed  # Switch to headed mode`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
