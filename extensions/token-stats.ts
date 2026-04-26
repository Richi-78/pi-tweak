/**
 * Token Stats - mostra l'uso totale dei token in tutte le sessioni
 *
 * Le stats vengono inviate come messaggio personalizzato nel contesto,
 * così appaiono all'avvio della sessione ma scorrono con il resto della
 * conversazione, proprio come l'avviso di sistema di pi.
 *
 * Mostra:
 * - Token attuali della sessione (input/output)
 * - Token totali di tutte le sessioni
 * - Risparmio stimato rispetto a modelli cloud
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { SessionManager } from "@mariozechner/pi-coding-agent";

/** Costi cloud: 1€/M input, 3€/M output */
const COST_INPUT_PER_M = 0.1;
const COST_OUTPUT_PER_M = 0.3;

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

/** Calcola il risparmio stimato rispetto a modelli cloud */
function calcSavings(input: number, output: number): string {
  const cost = (input / 1_000_000) * COST_INPUT_PER_M + (output / 1_000_000) * COST_OUTPUT_PER_M;
  return `${cost.toFixed(2)}€`;
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
      `  Sessione:  in ${fmt(cur.input)}  out ${fmt(cur.output)}`,
      `  Totale:    in ${fmt(totalInput)}  out ${fmt(totalOutput)} (${sessionCount} sessioni)`,
      `  Risparmiato (rispetto a DeepseekV4.0 Flash): ${savings}`,
    ];

    if (totalCacheRead > 0 || totalCacheWrite > 0) {
      content.push(`  Cache:     letture ${fmt(totalCacheRead)}  scritture ${fmt(totalCacheWrite)}`);
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
