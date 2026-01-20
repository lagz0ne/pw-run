# bwsr

Fast CLI for managing browser daemons via Playwright CDP.

## Inspiration

[agent-browser](https://github.com/anthropics/agent-browser) is a powerful tool for AI agents to interact with browsers via CDP. However, it expects a browser already running with CDP enabled.

**bwsr** fills that gap - it manages browser lifecycles so you can:

```bash
bwsr start                    # Start a browser daemon
agent-browser connect $(bwsr cdp) && agent-browser snapshot
bwsr stop --all               # Clean up when done
```

## Installation

```bash
npm install bwsr playwright-core
```

Then install a browser:

```bash
npx playwright install chromium
```

Verify your setup:

```bash
bwsr doctor
```

### Direct Download

Download binaries from [GitHub Releases](https://github.com/lagz0ne/pw-run/releases).

**Note:** You still need `playwright-core` installed separately:

```bash
npm install playwright-core
npx playwright install chromium
```

## Requirements

- **playwright-core** >= 1.40.0 (peer dependency)
- **Browser** - At least one of: Chromium, Firefox, or WebKit
- **Platform** - Linux or macOS (no Windows support)

## Quick Start

```bash
# Start a browser (returns session name)
bwsr start
# → happy-fox

# Get CDP port for agent-browser
bwsr cdp
# → 42711

# Use with agent-browser
agent-browser connect $(bwsr cdp)
agent-browser open https://example.com
agent-browser snapshot

# Stop all browsers
bwsr stop --all
```

## Commands

### `bwsr start`

Start a new browser instance.

```bash
bwsr start                        # Use default profile
bwsr start --profile my-profile   # Use specific profile
bwsr start --session my-session   # Custom session name
bwsr start --verbose              # Show detailed output
```

### `bwsr stop`

Stop browser instances.

```bash
bwsr stop happy-fox    # Stop specific session
bwsr stop --all        # Stop all sessions
```

### `bwsr list`

List running browser instances.

```bash
bwsr list
# happy-fox  default  42711  healthy
```

### `bwsr cdp`

Get CDP port for connecting tools like agent-browser.

```bash
bwsr cdp              # First available session
bwsr cdp happy-fox    # Specific session
```

### `bwsr profile`

Manage browser profiles.

```bash
bwsr profile create work
bwsr profile set work --browser chromium --headless
bwsr profile set work --viewport 1920x1080
bwsr profile list
bwsr profile show work
bwsr profile remove work
```

Profile options:
- `--browser <chromium|firefox|webkit>`
- `--headless` / `--no-headless`
- `--viewport <width>x<height>`
- `--locale <locale>`
- `--timezone <tz>`
- `--color-scheme <light|dark>`
- `--user-agent <string>`

### `bwsr doctor`

Check runtime requirements, browser availability, and system configuration.

```bash
bwsr doctor

# bwsr doctor
# ==================================================
#
# [Runtime]
#   ✓ playwright-core: 1.57.0
#
# [Configuration]
#   Config dir: ~/.bwsr
#   Profiles:   ~/.bwsr/profiles
#   Sockets:    ~/.bwsr/sockets
#
# [Browsers]
#   ✓ chromium: ~/.cache/ms-playwright/chromium-1194/chrome-linux/chrome
#   - firefox: not found
#   - webkit: not found
#
# [Status]
#   Running instances: 0
#
# ==================================================
# ✓ All checks passed. Ready to use bwsr.
```

If something is missing, doctor will suggest installation commands.

## Architecture

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌─────────┐
│   CLI   │────▶│ Watchdog │────▶│ Wrapper │────▶│ Browser │
└─────────┘     └──────────┘     └─────────┘     └─────────┘
                     │                │               │
                     │    IPC         │    IPC        │    CDP
                     │   (Unix        │   (Unix       │   (HTTP)
                     │   Socket)      │   Socket)     │
                     ▼                ▼               ▼
               Auto-starts      Manages          Playwright
               on first use     lifecycle        instance
```

- **CLI**: User-facing commands
- **Watchdog**: Central daemon that manages all browser instances
- **Wrapper**: Per-browser process with IPC server
- **Browser**: Actual Chromium/Firefox/WebKit via Playwright

The watchdog auto-starts when you run `bwsr start` and exits when no browsers remain.

## Platform Support

| Platform | Status |
|----------|--------|
| Linux x64 | ✅ |
| Linux ARM64 | ✅ |
| macOS x64 | ✅ |
| macOS ARM64 | ✅ |
| Windows | ❌ (no Unix sockets) |

## License

MIT
