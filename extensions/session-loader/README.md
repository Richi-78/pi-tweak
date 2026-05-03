# session-loader

Load a previous session from a scrollable picker overlay.

## Install

Copy `session-loader.ts` into your extensions directory:

```bash
cp session-loader.ts ~/.pi/agent/extensions/session-loader.ts
```

Or install from this repo:

```bash
git clone https://github.com/Richi-78/pi-tweak.git ~/.pi/pi-tweak
cp ~/.pi/pi-tweak/extensions/session-loader/session-loader.ts ~/.pi/agent/extensions/session-loader.ts
```

## Usage

Type `/load` and press Enter to open a session picker overlay.

Each session entry shows:

- Session name (or "Untitled" if unnamed)
- First message preview

### Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move selection up / down |
| `PageUp` / `PageDn` | Jump by page |
| `Ctrl+B` / `Ctrl+F` | Jump by page |
| `Enter` | Load selected session |
| `Esc` | Cancel |

## Screenshot

![Session Loader](./screenshot.png)
