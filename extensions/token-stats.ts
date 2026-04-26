/**
 * Token Stats - shows total token usage across all sessions
 *
 * Stats are sent as a custom message in context, appearing at session start
 * and scrolling with the conversation, just like pi's system prompt notice.
 *
 * Shows:
 * - Current session token usage (input/output)
 * - Total tokens across all sessions
 * - Estimated savings vs. cloud model pricing
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { SessionManager } from "@mariozechner/pi-coding-agent";

/**
 * Cloud model pricing per million tokens.
 * Adjust these to match your comparison baseline (e.g., $1/M input, $3/M output
 * is typical for mid-tier cloud models like Claude Haiku / GPT-4o-mini).
 */
const CLOUD_MODEL = {
  name: "Claude Haiku",
  inputPerM: 1.0,   // $/M input tokens
  outputPerM: 3.0,  // $/M output tokens
  currency: "$",
};

const COST_INPUT_PER_M = CLOUD_MODEL.inputPerM;
const COST_OUTPUT_PER_M = CLOUD_MODEL.outputPerM;

/** Formatta un numero con suffisso k/M */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

/** Somma i token dai messaggi assistant in una lista di entry di sessione */
function sumUsage(entries: { type: string; message: any }[]): {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
} {
  let input = 0, output = 0, cacheRead = 0, cacheWrite = 0;
  for (const e of entries) {
    if (e.type === "message" && e.message.role === "assistant") {
      const m = e.message as AssistantMessage;
      input += m.usage.input;
      output += m.usage.output;
      cacheRead += m.usage.cacheRead;
      cacheWrite += m.usage.cacheWrite;
    }
  }
  return { input, output, cacheRead, cacheWrite };
}

/** Calculate estimated savings vs. cloud model pricing */
function calcSavings(input: number, output: number): string {
  const cost = (input / 1_000_000) * COST_INPUT_PER_M + (output / 1_000_000) * COST_OUTPUT_PER_M;
  return `${CLOUD_MODEL.currency}${cost.toFixed(2)}`;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // Statistiche sessione corrente
    const cur = sumUsage(ctx.sessionManager.getEntries());

    // Statistiche totali su tutte le sessioni
    const sessions = await SessionManager.listAll();
    let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0;
    let sessionCount = 0;

    for (const sess of sessions) {
      if (!sess.path) continue;
      try {
        const sm = await SessionManager.open(sess.path);
        const stats = sumUsage(sm.getEntries());
        totalInput += stats.input;
        totalOutput += stats.output;
        totalCacheRead += stats.cacheRead;
        totalCacheWrite += stats.cacheWrite;
        sessionCount++;
      } catch {
        // Sessioni che non riesco a leggere, le salto
      }
    }

    const savings = calcSavings(totalInput, totalOutput);

    const content = [
      "⚡ **Token Usage**",
      `  Current:   in ${fmt(cur.input)}  out ${fmt(cur.output)}`,
      `  Total:     in ${fmt(totalInput)}  out ${fmt(totalOutput)} (${sessionCount} sessions)`,
      `  Savings   (compared to ${CLOUD_MODEL.name} ${CLOUD_MODEL.currency}${CLOUD_MODEL.inputPerM}/M - ${CLOUD_MODEL.currency}${CLOUD_MODEL.outputPerM}/M): ${savings}`,
    ];

    if (totalCacheRead > 0 || totalCacheWrite > 0) {
      content.push(`  Cache:     read ${fmt(totalCacheRead)}  write ${fmt(totalCacheWrite)}`);
    }

    // Invia come messaggio personalizzato nel contesto, così scorre con la conversazione
    pi.sendMessage(
      {
        customType: "token-stats",
        content: content.join("\n"),
        display: true,
      }
    );
  });
}
