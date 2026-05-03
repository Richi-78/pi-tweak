/**
 * Session Loader Extension
 *
 * Usage: type /load and press Enter to show a session picker overlay.
 * Scroll through all your sessions with ↑/↓, press Enter to load one,
 * or press Esc to cancel.
 *
 * Each session entry shows:
 *   ▶ Session name (or "Untitled")
 *     <first message preview>
 */

import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { matchesKey, type Focusable, visibleWidth } from "@mariozechner/pi-tui";

// ANSI color helpers
const colorMap: Record<string, number> = {
	dim: 245,
	text: 231,
	accent: 74,
	warning: 220,
	border: 241,
	success: 113,
	error: 203,
};

const c = (text: string, key: string): string => {
	const code = colorMap[key] ?? 231;
	return `\x1b[38;5;${code}m${text}\x1b[0m`;
};

interface SessionListItem {
	path: string;
	name: string;
	firstMessage: string;
	cwd: string;
	created: Date;
	messageCount: number;
}

export default function (pi: import("@mariozechner/pi-coding-agent").ExtensionAPI) {
	pi.registerCommand("load", {
		description: "Load a previous session from a list",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Session loader requires interactive mode", "error");
				return;
			}

			// Fetch all sessions
			let sessions: SessionListItem[];
			try {
				const raw = await SessionManager.listAll();
				sessions = raw.map((s) => ({
					path: s.path,
					name: s.name || "Untitled",
					firstMessage: s.firstMessage || "",
					cwd: s.cwd,
					created: s.created,
					messageCount: s.messageCount,
				}));
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`Failed to list sessions: ${msg}`, "error");
				return;
			}

			if (sessions.length === 0) {
				ctx.ui.notify("No sessions found", "info");
				return;
			}

			// Sort by date descending (newest first)
			sessions.sort((a, b) => b.created.getTime() - a.created.getTime());

			// Show the overlay
			const result = await ctx.ui.custom<SessionListItem | null>(
				(_tui, theme, _keybindings, done) =>
					new SessionPickerComponent(sessions, theme, done),
				{ overlay: true },
			);

			if (!result) {
				return; // cancelled
			}

			// Switch to the selected session
			try {
				const switchResult = await ctx.switchSession(result.path);
				if (switchResult.cancelled) {
					ctx.ui.notify("Session switch was cancelled", "info");
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`Failed to load session: ${msg}`, "error");
			}
		},
	});
}

/**
 * A focused session picker component.
 * Shows a scrollable list with session name + preview.
 */
class SessionPickerComponent implements Focusable {
	focused = false;
	selectedIndex = 0;

	readonly width = 80;

	constructor(
		private sessions: SessionListItem[],
		_theme: import("@mariozechner/pi-tui").Theme,
		private done: (result: SessionListItem | null) => void,
	) {}

	handleInput(data: string): void {
		if (matchesKey(data, "escape")) {
			this.done(null);
			return;
		}

		if (matchesKey(data, "up")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
		} else if (matchesKey(data, "down")) {
			this.selectedIndex = Math.min(this.sessions.length - 1, this.selectedIndex + 1);
		} else if (matchesKey(data, "return") || matchesKey(data, "enter")) {
			this.done(this.sessions[this.selectedIndex]!);
			return;
		} else if (matchesKey(data, "pageUp") || matchesKey(data, "ctrl+b")) {
			const step = Math.max(1, Math.floor(this.sessions.length / 4));
			this.selectedIndex = Math.max(0, this.selectedIndex - step);
		} else if (matchesKey(data, "pageDown") || matchesKey(data, "ctrl+f")) {
			const step = Math.max(1, Math.floor(this.sessions.length / 4));
			this.selectedIndex = Math.min(this.sessions.length - 1, this.selectedIndex + step);
		}
	}

	render(_width: number): string[] {
		const lines: string[] = [];
		const innerW = this.width - 2;

		const pad = (s: string, len: number): string => {
			const vis = visibleWidth(stripAnsi(s));
			return s + " ".repeat(Math.max(0, len - vis));
		};

		// Header
		lines.push(c(`╭${"─".repeat(innerW)}╮`, "border"));
		lines.push(
			c("│", "border") +
			pad(` ${c("📂 Load Session", "accent")}`, innerW) +
			c("│", "border"),
		);
		lines.push(c("│" + " ".repeat(innerW) + "│", "border"));

		// Session count
		lines.push(
			c("│", "border") +
			pad(` ${c(`${this.sessions.length} session(s)`, "dim")}`, innerW) +
			c("│", "border"),
		);
		lines.push(c("│" + " ".repeat(innerW) + "│", "border"));

		// Separator
		const sep = "─".repeat(Math.min(50, innerW - 6));
		lines.push(
			c("│", "border") +
			pad(` ${c(sep, "dim")}`, innerW) +
			c("│", "border"),
		);

		// Sessions
		for (let i = 0; i < this.sessions.length; i++) {
			const s = this.sessions[i]!;
			const isSelected = i === this.selectedIndex;

			// Name line
			const prefix = isSelected ? c("▸", "accent") : " ";
			let nameDisplay = s.name;
			if (stripAnsi(nameDisplay).length > innerW - 6) {
				nameDisplay = nameDisplay.slice(0, innerW - 9) + "…";
			}
			const nameLine = `${prefix} ${isSelected ? c(nameDisplay, "accent") : nameDisplay}`;
			lines.push(
				c("│", "border") +
				pad(` ${nameLine}`, innerW) +
				c("│", "border"),
			);

			// Preview line (only for selected, or always if short enough)
			if (isSelected && s.firstMessage) {
				let preview = s.firstMessage.trim();
				// Truncate to fit
				if (stripAnsi(preview).length > innerW - 6) {
					preview = preview.slice(0, innerW - 9) + "…";
				}
				lines.push(
					c("│", "border") +
					pad(` ${c(preview, "dim")}`, innerW) +
					c("│", "border"),
				);
			}
		}

		// Footer area - fill remaining space
		const usedLines = 5 + this.sessions.length + (this.sessions.length > 0 ? 1 : 0); // header+count+sep+items+preview+footer
		const totalLines = Math.max(usedLines, 14);
		const footerLines = totalLines - usedLines;
		for (let i = 0; i < Math.max(0, footerLines); i++) {
			lines.push(c("│" + " ".repeat(innerW) + "│", "border"));
		}

		// Instructions
		const hint = "↑↓ navigate • PageUp/PgDn • Enter load • Esc cancel";
		lines.push(c("│", "border") + pad(` ${c(hint, "dim")}`, innerW) + c("│", "border"));
		lines.push(c(`╰${"─".repeat(innerW)}╯`, "border"));

		return lines;
	}

	invalidate(): void {}
	dispose(): void {}
}

// --- helpers ---

function stripAnsi(s: string): string {
	return s.replace(/\x1b\[[^m]*m/g, "");
}
