# pi-tweak

Tweaks, extensions, and skills for [pi-mono]([https://github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) — the pi coding agent.

## What's inside

This repo collects useful additions for pi-mono:

| Directory | Contents |
|-----------|----------|
| `extensions/` | Extension `.ts` files — drop into your `~/.pi/agent/extensions/` directory |

## Usage

### Extensions

Each extension is a standalone `.ts` file. To install:

```bash
# Clone this repo
git clone https://github.com/Richi-78/pi-tweak.git ~/.pi/pi-tweak

# Copy extensions you want
cp ~/.pi/pi-tweak/extensions/*.ts ~/.pi/agent/extensions/
```

Or install a single extension manually by copying the `.ts` file directly into `~/.pi/agent/extensions/`.

## Extensions

- **[token-stats](./extensions/)** — Token usage statistics across all sessions
