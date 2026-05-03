# auto-session-name

Automatically names your PI session based on the first user prompt.

## Install

Copy `auto-session-name.ts` into your extensions directory:

```bash
cp auto-session-name.ts ~/.pi/agent/extensions/auto-session-name.ts
```

Or install from this repo:

```bash
git clone https://github.com/Richi-78/pi-tweak.git ~/.pi/pi-tweak
cp ~/.pi/pi-tweak/extensions/auto-session-name/auto-session-name.ts ~/.pi/agent/extensions/auto-session-name.ts
```

## How It Works

1. On the first interactive, non-empty, non-command input, the extension captures the text.
2. After the first agent turn completes, it silently renames the session using the first ~80 characters of the prompt (with `…` if truncated).
3. A flag is persisted so it only fires **once per session** — not on `/reload`, not on subsequent prompts.

## Example

Starting a session with:

> Refactor the auth module in my project to use JWT instead of session cookies

Will name the session:

> Refactor the auth module in my project to use JWT instead of session cookies…

## Screenshot

![Auto Session Name](./screenshot.png)
