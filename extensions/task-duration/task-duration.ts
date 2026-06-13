/**
 * Task Duration — shows elapsed time via toast after each agent turn.
 *
 * Records when a prompt is submitted (agent_start) and when the response
 * finishes (agent_end), then displays a brief toast notification with the
 * duration. The timing is NOT injected into chat/history.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

let startTime: number | null = null;

/** Format ms into a human string like "2 min 34 sec" or "15 sec" or "0.4 sec" */
function formatDuration(ms: number): string {
  if (ms < 1_000) return `${(ms / 1_000).toFixed(1)} sec`;
  const s = Math.floor(ms / 1_000);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return m === 1 && remS === 0
    ? `1 min`
    : remS > 0
      ? `${m} min ${remS} sec`
      : `${m} min`;
}

export default function (pi: ExtensionAPI) {
  pi.on("agent_start", async (_event, _ctx) => {
    startTime = Date.now();
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (startTime === null) return;

    const elapsed = Date.now() - startTime;
    const durationStr = formatDuration(elapsed);

    // Show a brief toast for immediate feedback only (not in chat/history)
    ctx.ui.notify(`Task completed in ${durationStr}`, "info");

    startTime = null;
  });
}
