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
      if (flags.colorScheme) updates.colorScheme = flags.colorScheme;
      if (flags.userAgent) updates.userAgent = flags.userAgent;
      if (flags.proxy) updates.proxy = flags.proxy;
      if (flags.ignoreHTTPSErrors !== undefined) updates.ignoreHTTPSErrors = flags.ignoreHTTPSErrors === true || flags.ignoreHTTPSErrors === "true";
      if (flags.offline !== undefined) updates.offline = flags.offline === true || flags.offline === "true";
      if (flags.args) updates.args = (flags.args as string).split(",");
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

    case "help":
    case undefined:
      printProfileHelp();
      break;

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      printProfileHelp();
      process.exit(1);
  }
}

function printProfileHelp(): void {
  console.log(`bwsr profile - Manage browser profiles

Usage: bwsr profile <command> [name] [options]

Commands:
  create <name>     Create a new profile
  set <name>        Update profile settings
  remove <name>     Delete a profile
  list              List all profiles
  show <name>       Show profile details
  help              Show this help

Profile Settings (use with 'set'):
  --browser <type>        Browser engine: chromium, firefox, webkit
                          Default: chromium
  --headless              Run in headless mode (no visible window)
                          Default: true
  --headed                Run in headed mode (visible window)
  --executable <path>     Custom browser executable path
  --viewport <WxH>        Viewport size, e.g., 1920x1080
  --locale <code>         Browser locale, e.g., en-US, ja-JP
  --timezone <tz>         Timezone, e.g., America/New_York
  --colorScheme <mode>    Color scheme: light, dark, no-preference
  --userAgent <string>    Custom user agent string
  --proxy <url>           Proxy server URL
  --ignoreHTTPSErrors     Ignore HTTPS certificate errors
  --offline               Simulate offline mode
  --args <arg1,arg2,...>  Additional browser args (comma-separated)

Examples:
  bwsr profile create mobile
  bwsr profile set mobile --viewport 375x812 --userAgent "Mobile Safari"
  bwsr profile set default --headed --colorScheme dark
  bwsr profile set default --proxy http://localhost:8080
  bwsr profile show default`);
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

  console.log(`
${"=".repeat(60)}
AI Agent Usage Patterns:

  # Basic workflow - start once, reuse across tasks
  bwsr start                     # Start browser (reuses if running)
  CDP=$(bwsr cdp)                # Get ws://localhost:PORT endpoint
  bwsr stop                      # Cleanup when done

  # Use with Playwright (in code)
  import { chromium } from 'playwright-core';
  const browser = await chromium.connectOverCDP(process.env.CDP);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  # Use with Puppeteer (in code)
  import puppeteer from 'puppeteer-core';
  const browser = await puppeteer.connect({ browserWSEndpoint: CDP });

  # Use with agent-browser CLI
  bwsr start
  agent-browser --cdp $(bwsr cdp) snapshot
  agent-browser --cdp $(bwsr cdp) click --ref e5
  agent-browser --cdp $(bwsr cdp) screenshot tmp/page.png

  # Use with dev-browser (set CDP_ENDPOINT env)
  bwsr start
  export CDP_ENDPOINT=$(bwsr cdp)
  cd dev-browser && npx tsx script.ts

  # Parallel sessions for concurrent tasks
  bwsr start --session research  # Named session
  bwsr start --session testing   # Another session
  bwsr cdp research              # Get specific endpoint
  bwsr stop research             # Stop specific session

  # Visible browser for debugging
  bwsr profile set default --headed
  bwsr stop && bwsr start --force

  # Configure for web scraping
  bwsr profile set default --viewport 1920x1080 --locale en-US

  # Run 'bwsr profile' for all configuration options
${"=".repeat(60)}`);

  if (isFirstTime) {
    console.log(`
First time? Run 'bwsr doctor' to verify dependencies.`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
