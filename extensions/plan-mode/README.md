# Plan Mode Extension

> Read-only exploration mode for safe code analysis and structured plan execution.

## Overview

Plan Mode is a Pi coding agent extension that enables a **read-only exploration mode** for safe code analysis. When enabled, built-in write tools (`edit`, `write`) are disabled, and bash commands are restricted to an allowlist of read-only operations.

It provides a structured workflow for:
1. **Planning** — Create a numbered, step-by-step plan for a task.
2. **Execution** — Execute the plan with full tool access, tracking progress step by step.
3. **Persistence** — Plans are saved to `plan.md` in the current working directory, enabling resume across sessions.

## Features

- **Read-only mode** — Blocks destructive bash commands (`rm`, `mv`, `cp`, `git push`, etc.)
- **Plan extraction** — Automatically parses numbered plans from `Plan:` sections in agent responses
- **Progress tracking** — Visual widget showing completed/remaining steps with `[DONE:n]` markers
- **Plan persistence** — Plans saved to `plan.md`, automatically detected and offered for continuation on session resume
- **Tool management** — Dynamically enables/disables write tools based on mode
- **Keyboard shortcut** — `Ctrl+Alt+P` to toggle plan mode

## Installation

Place this extension in your Pi extensions directory:

```
~/.pi/agent/extensions/plan-mode/
```

The extension is loaded automatically by the Pi coding agent. No additional configuration needed.

## Usage

### Toggle Plan Mode

| Method | Action |
|--------|--------|
| `Ctrl+Alt+P` | Toggle plan mode on/off |
| `/plan` | Toggle plan mode via slash command |
| `/todos` | Show current plan todo list |

### Workflow

1. **Enable plan mode** (via shortcut or command)
2. **Ask the agent** to analyze your codebase and create a plan
3. The agent will respond with a `Plan:` section containing numbered steps
4. Choose what to do:
   - **Execute the plan** — Switch to execution mode with full tool access, tracking progress
   - **Stay in plan mode** — Continue exploring without executing
   - **Refine the plan** — Edit the plan before execution
5. During execution, include `[DONE:n]` tags after completing each step
6. Progress is tracked in the UI widget and saved to `plan.md`

### plan.md Format

Plans are stored in `plan.md` with the following structure:

```markdown
# Plan

[Plan steps here]

## Progress

- [x] 1. Complete step
- [ ] 2. Remaining step
```

On session resume with plan mode active, the extension detects existing `plan.md` and offers:
- **Continue this plan** — Resume from the last uncompleted step
- **Create a new plan** — Start fresh while keeping the old file
- **Delete old plan** — Remove `plan.md` and start fresh

## Bash Allowlist

### Allowed Commands

`cat`, `head`, `tail`, `less`, `more`, `grep`, `find`, `ls`, `pwd`, `echo`, `printf`, `wc`, `sort`, `uniq`, `diff`, `file`, `stat`, `du`, `df`, `tree`, `which`, `whereis`, `type`, `env`, `printenv`, `uname`, `whoami`, `id`, `date`, `cal`, `uptime`, `ps`, `top`, `htop`, `free`, `git status/log/diff/show/branch/remote`, `git ls-*`, `npm list/ls/view/info/search`, `yarn list/info/why`, `curl`, `jq`, `sed -n`, `awk`, `rg`, `fd`, `bat`, `eza`

### Blocked Commands

`rm`, `rmdir`, `mv`, `cp`, `mkdir`, `touch`, `chmod`, `chown`, `ln`, `tee`, `truncate`, `shred`, `dd`, shell redirections (`>`, `>>`), package managers (`npm install`, `yarn add`, `pip install`, `apt install`, `brew install`), `git add/commit/push/pull/merge`, `sudo`, `su`, `kill`, `reboot`, `shutdown`, `systemctl`, `service`, `vim`, `nano`, `emacs`, `code`

## Architecture

### Files

| File | Description |
|------|-------------|
| `index.ts` | Main extension logic — hooks, commands, UI integration, state management |
| `utils.ts` | Pure utility functions — command validation, plan parsing, step extraction |

### Extension Hooks

The extension uses the Pi extension API to hook into the agent lifecycle:

- `session_start` — Restore persisted state, check for existing `plan.md`
- `before_agent_start` — Inject plan mode or execution context
- `tool_call` — Block destructive bash commands
- `context` — Filter out plan mode context when not active
- `agent_end` — Extract plans, handle plan.md operations
- `turn_end` — Track progress markers (`[DONE:n]`)

### State Persistence

Plan mode state is persisted across turns using `pi.appendEntry()` and restored on session start/resume. This includes:
- Mode enabled/disabled
- Todo items with completion status
- Execution mode flag
- Previously active tools list

## Development

### Extending the Allowlist

Edit `utils.ts` and add patterns to the `SAFE_PATTERNS` array:

```typescript
const SAFE_PATTERNS = [
  // ... existing patterns
  /^\s*your-command\b/i,
];
```

### Adding Blocked Commands

Add patterns to the `DESTRUCTIVE_PATTERNS` array in `utils.ts`:

```typescript
const DESTRUCTIVE_PATTERNS = [
  // ... existing patterns
  /\byour-destructive-command\b/i,
];
```

## Dependencies

This extension depends on:
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-tui`

## License

Same license as the Pi coding agent project.
