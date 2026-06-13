# task-duration

Shows elapsed time via toast notification after each agent turn for [pi-mono](https://github.com/badlogic/pi-mono).

## Install

Copy `task-duration.ts` into your extensions directory:

```bash
cp task-duration.ts ~/.pi/agent/extensions/task-duration.ts
```

Or install from this repo:

```bash
git clone https://github.com/Richi-78/pi-tweak.git ~/.pi/pi-tweak
cp ~/.pi/pi-tweak/extensions/task-duration/task-duration.ts ~/.pi/agent/extensions/
```

## Features

- Shows task completion time in a toast notification
- Human-readable format: `0.4 sec`, `15 sec`, `2 min 34 sec`
- No impact on chat history or context
