# pi-tweak

Tweaks, extensions, and skills for [pi-mono]([https://github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) — the pi coding agent.
Needless to say these are mainly written by pi itself :) mainly locally, mainly using qwen3.6-35B-A3B (spefically using https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF UD-IQ4_NL quantized version since)

## What's inside

This repo collects useful additions for pi-mono:

| Directory | Contents |
|-----------|----------|
| `extensions/` | Extension folders — each contains `.ts`, `README.md`, and a `screenshot.png` placeholder |

## Usage

### Extensions

Each extension lives in its own folder. To install:

```bash
# Clone this repo
git clone https://github.com/Richi-78/pi-tweak.git ~/.pi/pi-tweak

# Copy specific extensions
cp ~/.pi/pi-tweak/extensions/token-stats/token-stats.ts ~/.pi/agent/extensions/
cp ~/.pi/pi-tweak/extensions/auto-session-name/auto-session-name.ts ~/.pi/agent/extensions/
cp ~/.pi/pi-tweak/extensions/session-loader/session-loader.ts ~/.pi/agent/extensions/
```

## Extensions

| Extension | Description |
|-----------|-------------|
| **[token-stats](./extensions/token-stats/)** | Token usage statistics across all sessions |
