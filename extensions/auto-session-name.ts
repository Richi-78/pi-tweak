/**
 * Auto-rename session based on the first user prompt.
 *
 * Workflow:
 *   1. On the first interactive, non-empty, non-command input, capture the text
 *      and let the agent respond normally (no interrupt).
 *   2. After the first agent turn completes (agent_end), the extension silently
 *      calls pi.setSessionName() with a short summary extracted from the prompt.
 *   3. On session_shutdown, the "hasNamedFirstPrompt" flag is persisted via
 *      appendEntry so it survives /reload.
 *   4. On session_start, the flag is restored from persisted entries.
 *
 * Only fires once per session — not on /reload, not on subsequent prompts.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const FLAG_CUSTOM_TYPE = "auto-session-name/flag";

export default function (pi: ExtensionAPI) {
  let hasNamedFirstPrompt = false;
  let pendingFirstPrompt = "";

  // ── Restore persisted flag on session start ──────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    // Check if we previously persisted the flag in this session
    const entries = ctx.sessionManager.getEntries();
    for (const entry of entries) {
      if (
        entry.type === "custom" &&
        entry.customType === FLAG_CUSTOM_TYPE &&
        (entry.data as any)?.hasNamedFirstPrompt
      ) {
        hasNamedFirstPrompt = true;
        break;
      }
    }
  });

  // ── Persist the flag on shutdown (survives /reload) ──────────────────
  pi.on("session_shutdown", async (_event, ctx) => {
    if (hasNamedFirstPrompt) {
      pi.appendEntry(FLAG_CUSTOM_TYPE, {
        hasNamedFirstPrompt: true,
        timestamp: Date.now(),
      });
    }
  });

  // ── Capture the first user prompt ────────────────────────────────────
  pi.on("input", async (event, _ctx) => {
    if (hasNamedFirstPrompt) return;
    if (event.source !== "interactive") return;

    const text = event.text.trim();
    if (!text || text.startsWith("/")) return;

    // Capture the prompt text — we'll name after the first response
    pendingFirstPrompt = text;
  });

  // ── After the first agent turn completes, silently name the session ──
  pi.on("agent_end", async (event, _ctx) => {
    if (!pendingFirstPrompt || hasNamedFirstPrompt) return;

    hasNamedFirstPrompt = true;
    const prompt = pendingFirstPrompt;
    pendingFirstPrompt = ""; // consume

    // Use the first ~80 chars as the session name
    const maxLen = 80;
    const name = prompt.length > maxLen ? prompt.slice(0, maxLen) + "…" : prompt;

    // Direct call — no agent involvement, completely silent
    pi.setSessionName(name);
  });
}
