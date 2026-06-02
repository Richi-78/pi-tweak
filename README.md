# pi-tweak

Tweaks, extensions, and skills for [pi-mono]([https://github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) — the pi coding agent.
Needless to say these are mainly written by pi itself :) mainly locally, mainly using qwen3.6-35B-A3B (spefically using https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF UD-IQ4_NL quantized version since)

## What's inside

This repo collects useful additions for pi-mono:

| Directory | Contents |
|-----------|----------|
| `extensions/` | Extension folders — each contains `.ts`, `README.md`, and a `screenshot.png` placeholder |
| `skills/` | Skill folders — each contains a `SKILL.md` with specialized instructions |

## Usage

### Extensions

Each extension lives in its own folder. To install:

```bash
# Clone this repo
git clone https://github.com/Richi-78/pi-tweak.git ~/.pi/pi-tweak

# Copy specific extensions
cp ~/.pi/pi-tweak/extensions/token-stats/token-stats.ts ~/.pi/agent/extensions/

# Copy specific skills
cp -r ~/.pi/pi-tweak/skills/tavily-web-search ~/.pi/agent/skills/tavily-web-search
```

## Extensions

| Extension | Description |
|-----------|-------------|
| **[token-stats](./extensions/token-stats/)** | Token usage statistics across all sessions |
| **[tavily-web-search](./extensions/tavily-web-search/)** | Web search, page extraction, and site crawling via Tavily API |

## Skills

| Skill | Description |
|-------|-------------|
| **[tavily-web-search](./skills/tavily-web-search/)** | Search the web, extract page content, and crawl sites using Tavily API |
