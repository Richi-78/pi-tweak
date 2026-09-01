/**
 * Plan Mode Extension
 *
 * Read-only exploration mode for safe code analysis.
 * When enabled, built-in write tools are disabled.
 *
 * Features:
 * - /plan command or Ctrl+Alt+P to toggle
 * - Bash restricted to allowlisted read-only commands
 * - Extracts numbered plan steps from "Plan:" sections
 * - [DONE:n] markers to complete steps during execution
 * - Progress tracking widget during execution
 * - plan.md persistence — writes/reads plan.md in CWD
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import {
	extractTodoItems,
	extractPlanSection,
	parsePlanMd,
	isSafeCommand,
	markCompletedSteps,
	type TodoItem,
} from "./utils.ts";

// Tools
const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire"];
const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write"];
const PLAN_MODE_DISABLED_TOOLS = new Set<string>(["edit", "write"]);
const PLAN_MANAGED_TOOLS = new Set<string>([...PLAN_MODE_TOOLS, ...NORMAL_MODE_TOOLS]);

interface PlanModeState {
	enabled: boolean;
	todos?: TodoItem[];
	executing?: boolean;
	toolsBeforePlanMode?: string[];
}

// Type guard for assistant messages
function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
	return m.role === "assistant" && Array.isArray(m.content);
}

// Extract text content from an assistant message
function getTextContent(message: AssistantMessage): string {
	return message.content
		.filter((block): block is TextContent => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

export default function planModeExtension(pi: ExtensionAPI): void {
	let planModeEnabled = false;
	let executionMode = false;
	let todoItems: TodoItem[] = [];
	let toolsBeforePlanMode: string[] | undefined;
	let lastPlanSectionText = "";

	pi.registerFlag("plan", {
		description: "Start in plan mode (read-only exploration)",
		type: "boolean",
		default: false,
	});

	function updateStatus(ctx: ExtensionContext): void {
		// Footer status
		if (executionMode && todoItems.length > 0) {
			const completed = todoItems.filter((t) => t.completed).length;
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("accent", `📋 ${completed}/${todoItems.length}`));
		} else if (planModeEnabled) {
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", "⏸ plan"));
		} else {
			ctx.ui.setStatus("plan-mode", undefined);
		}

		// Widget showing todo list
		if (executionMode && todoItems.length > 0) {
			const lines = todoItems.map((item) => {
				if (item.completed) {
					return (
						ctx.ui.theme.fg("success", "☑ ") + ctx.ui.theme.fg("muted", ctx.ui.theme.strikethrough(item.text))
					);
				}
				return `${ctx.ui.theme.fg("muted", "☐ ")}${item.text}`;
			});
			ctx.ui.setWidget("plan-todos", lines);
		} else {
			ctx.ui.setWidget("plan-todos", undefined);
		}
	}

	function uniqueToolNames(toolNames: string[]): string[] {
		return [...new Set(toolNames)];
	}

	function getPlanModeTools(activeToolNames: string[]): string[] {
		return uniqueToolNames([
			...activeToolNames.filter((name) => !PLAN_MODE_DISABLED_TOOLS.has(name)),
			...PLAN_MODE_TOOLS,
		]);
	}

	function getNormalModeTools(activeToolNames: string[]): string[] {
		return uniqueToolNames([
			...NORMAL_MODE_TOOLS,
			...activeToolNames.filter((name) => !PLAN_MANAGED_TOOLS.has(name)),
		]);
	}

	function enablePlanModeTools(): void {
		if (toolsBeforePlanMode === undefined) {
			toolsBeforePlanMode = pi.getActiveTools();
		}
		pi.setActiveTools(getPlanModeTools(toolsBeforePlanMode));
	}

	function restoreNormalModeTools(): void {
		pi.setActiveTools(toolsBeforePlanMode ?? getNormalModeTools(pi.getActiveTools()));
		toolsBeforePlanMode = undefined;
	}

	function persistState(): void {
		pi.appendEntry("plan-mode", {
			enabled: planModeEnabled,
			todos: todoItems,
			executing: executionMode,
			toolsBeforePlanMode,
		});
	}

	function togglePlanMode(ctx: ExtensionContext): void {
		planModeEnabled = !planModeEnabled;
		executionMode = false;
		todoItems = [];

		if (planModeEnabled) {
			enablePlanModeTools();
			ctx.ui.notify("Plan mode enabled. Built-in write tools disabled.");
		} else {
			restoreNormalModeTools();
			ctx.ui.notify("Plan mode disabled. Full access restored.");
		}
		updateStatus(ctx);
		persistState();
	}

	pi.registerCommand("plan", {
		description: "Toggle plan mode (read-only exploration)",
		handler: async (_args, ctx) => togglePlanMode(ctx),
	});

	pi.registerCommand("todos", {
		description: "Show current plan todo list",
		handler: async (_args, ctx) => {
			if (todoItems.length === 0) {
				ctx.ui.notify("No todos. Create a plan first with /plan", "info");
				return;
			}
			const list = todoItems.map((item, i) => `${i + 1}. ${item.completed ? "✓" : "○"} ${item.text}`).join("\n");
			ctx.ui.notify(`Plan Progress:\n${list}`, "info");
		},
	});

	pi.registerShortcut(Key.ctrlAlt("p"), {
		description: "Toggle plan mode",
		handler: async (ctx) => togglePlanMode(ctx),
	});

	// Block destructive bash commands in plan mode
	pi.on("tool_call", async (event) => {
		if (!planModeEnabled || event.toolName !== "bash") return;

		const command = event.input.command as string;
		if (!isSafeCommand(command)) {
			return {
				block: true,
				reason: `Plan mode: command blocked (not allowlisted). Use /plan to disable plan mode first.\nCommand: ${command}`,
			};
		}
	});

	// Filter out stale plan mode context when not in plan mode
	pi.on("context", async (event) => {
		if (planModeEnabled) return;

		return {
			messages: event.messages.filter((m) => {
				const msg = m as AgentMessage & { customType?: string };
				if (msg.customType === "plan-mode-context") return false;
				if (msg.role !== "user") return true;

				const content = msg.content;
				if (typeof content === "string") {
					return !content.includes("[PLAN MODE ACTIVE]");
				}
				if (Array.isArray(content)) {
					return !content.some(
						(c) => c.type === "text" && (c as TextContent).text?.includes("[PLAN MODE ACTIVE]"),
					);
				}
				return true;
			}),
		};
	});

	// Inject plan/execution context before agent starts
	pi.on("before_agent_start", async () => {
		if (planModeEnabled) {
			return {
				message: {
					customType: "plan-mode-context",
					content: `[PLAN MODE ACTIVE]
You are in plan mode - a read-only exploration mode for safe code analysis.

Restrictions:
- Built-in edit and write tools are disabled
- Other currently active tools remain available
- Bash is restricted to an allowlist of read-only commands

Ask clarifying questions using the questionnaire tool.
Use brave-search skill via bash for web research.

Create a detailed numbered plan under a "Plan:" header:

Plan:
1. First step description
2. Second step description
...

Do NOT attempt to make changes - just describe what you would do.`,
					display: false,
				},
			};
		}

		if (executionMode && todoItems.length > 0) {
			const remaining = todoItems.filter((t) => !t.completed);
			const todoList = remaining.map((t) => `${t.step}. ${t.text}`).join("\n");
			return {
				message: {
					customType: "plan-execution-context",
					content: `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
${todoList}

Execute each step in order.
After completing a step, include a [DONE:n] tag in your response.`,
					display: false,
				},
			};
		}
	});

	// Track progress after each turn
	pi.on("turn_end", async (event, ctx) => {
		if (!executionMode || todoItems.length === 0) return;
		if (!isAssistantMessage(event.message)) return;

		const text = getTextContent(event.message);
		if (markCompletedSteps(text, todoItems) > 0) {
			updateStatus(ctx);
			// Update plan.md to reflect newly completed steps
			const progressLines = todoItems.map((t) => `- [${t.completed ? "x" : " "}] ${t.step}. ${t.text}`).join("\n");
			const planMdContent = `# Plan\n\n${lastPlanSectionText}\n\n## Progress\n\n${progressLines}`;
			pi.sendMessage(
				{
					customType: "update-plan-md",
					content: `Update plan.md in the current working directory with the following EXACT content:\n\n\`\`\`\n${planMdContent}\n\`\`\``,
					display: false,
				},
				{ triggerTurn: true, deliverAs: "followUp" },
			);
		}
		persistState();
	});

	// ── plan.md persistence helpers ──────────────────────────────────────

	/**
	 * Send a silent message to the agent asking it to check for and read plan.md.
	 */
	function checkForExistingPlanMd(ctx: ExtensionContext): void {
		pi.sendMessage(
			{
				customType: "check-plan-md",
				content:
					"Check if plan.md exists in the current working directory. If it exists, read it and report its full contents verbatim. If it doesn't exist, reply with exactly: NO_PLAN_MD_FOUND",
				display: false,
			},
			{ triggerTurn: true, deliverAs: "followUp" },
		);
	}

	/**
	 * Handle the agent's response to the plan.md check.
	 */
	function handleExistingPlanMd(content: string, ctx: ExtensionContext): void {
		if (content.includes("NO_PLAN_MD_FOUND")) {
			// No existing plan.md — nothing to do, proceed normally
			return;
		}

		// Parse the plan.md content
		const todos = parsePlanMd(content);
		if (todos.length === 0) {
			// Could not parse — proceed normally
			return;
		}

		// Show existing plan in widget + prompt
		const lines = todos.map((t) =>
			t.completed
				? ctx.ui.theme.fg("success", "☑ ") + ctx.ui.theme.fg("muted", ctx.ui.theme.strikethrough(t.text))
				: `${ctx.ui.theme.fg("muted", "☐ ")}${t.text}`,
		);
		ctx.ui.setWidget("plan-todos", [
			ctx.ui.theme.fg("warning", "📋 Existing plan.md found — choose an action:"),
			"",
			...lines,
		]);

		ctx.ui
			.select("Existing plan.md found. What would you like to do?", [
				"Continue this plan",
				"Create a new plan",
				"Delete old plan and start fresh",
			])
			.then((choice) => {
				if (!choice) return;

				if (choice.startsWith("Continue")) {
					// Resume execution from the last uncompleted step
					planModeEnabled = false;
					executionMode = true;
					todoItems = todos;
					restoreNormalModeTools();
					updateStatus(ctx);
					persistState();

					const remaining = todos.filter((t) => !t.completed);
					const remainingList = remaining.map((t) => `${t.step}. ${t.text}`).join("\n");
					pi.sendMessage(
						{
							customType: "plan-mode-execute",
							content:
								`Continue executing the existing plan from plan.md.\n\nRemaining steps:\n${remainingList}\n\nStart with the next uncompleted step. After completing a step, include a [DONE:n] tag.`,
							display: true,
						},
						{ triggerTurn: true, deliverAs: "followUp" },
					);
				} else if (choice.startsWith("Create")) {
					// Keep existing plan.md, start a fresh plan
					pi.sendMessage(
						{
							customType: "plan-mode-new",
							content: "Create a new plan. You may refer to the existing plan.md for context but start fresh.",
							display: true,
						},
						{ triggerTurn: true, deliverAs: "followUp" },
					);
				} else if (choice.startsWith("Delete")) {
					// Delete plan.md and start fresh
					pi.sendMessage(
						{
							customType: "plan-mode-delete",
							content:
								"Delete plan.md from the current working directory and start fresh — create a new plan.",
							display: true,
						},
						{ triggerTurn: true, deliverAs: "followUp" },
					);
				}
			});
	}

	/**
	 * Send a message to the agent instructing it to write/update plan.md.
	 */
	function sendPlanMdWriteInstruction(planSectionText: string, ctx: ExtensionContext): void {
		const progressLines = todoItems.map((t) => `- [${t.completed ? "x" : " "}] ${t.step}. ${t.text}`).join("\n");
		const planMdContent = `# Plan\n\n${planSectionText}\n\n## Progress\n\n${progressLines}`;

		pi.sendMessage(
			{
				customType: "write-plan-md",
				content: `IMPORTANT: Before executing any steps, save this plan to plan.md in the current working directory.\n\nWrite the following EXACT content to plan.md:\n\n\`\`\`\n${planMdContent}\n\`\`\``,
				display: false,
			},
			{ triggerTurn: true, deliverAs: "followUp" },
		);
	}

	/**
	 * Check if the last user message in the turn is a plan.md check.
	 */
	function isPlanMdCheckMessage(m: AgentMessage): boolean {
		if (m.role !== "user") return false;
		const msg = m as AgentMessage & { customType?: string };
		return msg.customType === "check-plan-md";
	}

	/**
	 * Check if the last user message is a write-plan-md command.
	 */
	function isPlanMdWriteMessage(m: AgentMessage): boolean {
		if (m.role !== "user") return false;
		const msg = m as AgentMessage & { customType?: string };
		return msg.customType === "write-plan-md";
	}

	/**
	 * Check if the last user message is a plan action (delete/new).
	 */
	function isPlanActionMessage(m: AgentMessage): boolean {
		if (m.role !== "user") return false;
		const msg = m as AgentMessage & { customType?: string };
		return msg.customType === "plan-mode-delete" || msg.customType === "plan-mode-new";
	}

	// ── Original plan-creation / execution-complete logic ────────────────
	// Extracted so we can call it from the combined agent_end handler below.

	function runPlanLogic(event: { messages: AgentMessage[] }, ctx: ExtensionContext): void {
		// Check if execution is complete
		if (executionMode && todoItems.length > 0) {
			if (todoItems.every((t) => t.completed)) {
				const completedList = todoItems.map((t) => `~~${t.text}~~`).join("\n");
				pi.sendMessage(
					{ customType: "plan-complete", content: `**Plan Complete!** ✓\n\n${completedList}`, display: true },
					{ triggerTurn: false },
				);
				executionMode = false;
				todoItems = [];
				updateStatus(ctx);
				persistState(); // Save cleared state so resume doesn't restore old execution mode
			}
			return;
		}

		if (!planModeEnabled || !ctx.hasUI) return;

		// Extract todos from last assistant message
		const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
		if (lastAssistant) {
			const extracted = extractTodoItems(getTextContent(lastAssistant));
			if (extracted.length > 0) {
				todoItems = extracted;
			}
		}

		if (todoItems.length === 0) return;
		persistState();

		// Extract the raw plan section for plan.md
		lastPlanSectionText = extractPlanSection(getTextContent(lastAssistant!));

		// Show plan steps and prompt for next action
		const todoListText = todoItems.map((t, i) => `${i + 1}. ☐ ${t.text}`).join("\n");
		const planTodoListMessage = {
			customType: "plan-todo-list",
			content: `**Plan Steps (${todoItems.length}):**\n\n${todoListText}`,
			display: true,
		};

		const choice = ctx.ui.select("Plan mode - what next?", [
			"Execute the plan (track progress)",
			"Stay in plan mode",
			"Refine the plan",
		]);

		choice.then((choice) => {
			if (!choice) return;

			if (choice.startsWith("Execute")) {
				const firstTodoItem = todoItems[0];
				if (!firstTodoItem) return;

				planModeEnabled = false;
				executionMode = true;
				restoreNormalModeTools();
				updateStatus(ctx);
				persistState();

				// Write plan.md now that write tools are available
				if (lastPlanSectionText) {
					sendPlanMdWriteInstruction(lastPlanSectionText, ctx);
				}

				// Send execution message (includes plan for context)
				const remainingList = todoItems.map((t) => `${t.step}. ${t.text}`).join("\n");
				const execMessage = `Execute the plan.\n\nRemaining steps:\n${remainingList}\n\nStart with: ${firstTodoItem.text}\nAfter completing a step, include a [DONE:n] tag in your response.`;
				pi.sendMessage(planTodoListMessage, { deliverAs: "followUp" });
				pi.sendMessage(
					{ customType: "plan-mode-execute", content: execMessage, display: true },
					{ triggerTurn: true, deliverAs: "followUp" },
				);
			} else if (choice === "Refine the plan") {
				ctx.ui.editor("Refine the plan:", "").then((refinement) => {
					if (refinement?.trim()) {
						pi.sendMessage(planTodoListMessage, { deliverAs: "followUp" });
						pi.sendUserMessage(refinement.trim(), { deliverAs: "followUp" });
					}
				});
			}
			// "Stay in plan mode" — do nothing
		});
	}

	// ── Combined agent_end handler ───────────────────────────────────────
	// Intercepts plan.md check/write/action responses before running the
	// original plan-creation / execution-complete logic.

	pi.on("agent_end", async (event, ctx) => {
		// 1. Intercept plan.md check response
		const lastUserMsg = [...event.messages].reverse().find((m) => m.role === "user");
		if (lastUserMsg && isPlanMdCheckMessage(lastUserMsg)) {
			const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
			if (lastAssistant) {
				const text = getTextContent(lastAssistant);
				handleExistingPlanMd(text, ctx);
			}
			return;
		}

		// 2. Intercept plan.md write / delete / new-plan completions
		if (lastUserMsg && (isPlanMdWriteMessage(lastUserMsg) || isPlanActionMessage(lastUserMsg))) {
			// Agent has written/deleted/created plan.md — nothing more to do
			return;
		}

		// 3. Run the original plan-creation / execution-complete logic
		runPlanLogic(event, ctx);
	});

	// ── Restore state on session start/resume ────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		if (pi.getFlag("plan") === true) {
			planModeEnabled = true;
		}

		const entries = ctx.sessionManager.getEntries();

		// Restore persisted state
		const planModeEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "plan-mode")
			.pop() as { data?: PlanModeState } | undefined;

		if (planModeEntry?.data) {
			planModeEnabled = planModeEntry.data.enabled ?? planModeEnabled;
			todoItems = planModeEntry.data.todos ?? todoItems;
			executionMode = planModeEntry.data.executing ?? executionMode;
			toolsBeforePlanMode = planModeEntry.data.toolsBeforePlanMode ?? toolsBeforePlanMode;
		}

		// On resume: re-scan messages to rebuild completion state
		// Only scan messages AFTER the last "plan-mode-execute" to avoid picking up [DONE:n] from previous plans
		const isResume = planModeEntry !== undefined;
		if (isResume && executionMode && todoItems.length > 0) {
			// Find the index of the last plan-mode-execute entry (marks when current execution started)
			let executeIndex = -1;
			for (let i = entries.length - 1; i >= 0; i--) {
				const entry = entries[i] as { type: string; customType?: string };
				if (entry.customType === "plan-mode-execute") {
					executeIndex = i;
					break;
				}
			}

			// Only scan messages after the execute marker
			const messages: AssistantMessage[] = [];
			for (let i = executeIndex + 1; i < entries.length; i++) {
				const entry = entries[i];
				if (entry.type === "message" && "message" in entry && isAssistantMessage(entry.message as AgentMessage)) {
					messages.push(entry.message as AssistantMessage);
				}
			}
			const allText = messages.map(getTextContent).join("\n");
			markCompletedSteps(allText, todoItems);
		}

		if (planModeEnabled) {
			enablePlanModeTools();
		}

		// ── Check for existing plan.md only when plan mode is active ──
		// Only check when plan mode is enabled (either via flag or restored from persisted state)
		if (planModeEnabled) {
			checkForExistingPlanMd(ctx);
		}

		updateStatus(ctx);
	});
}
