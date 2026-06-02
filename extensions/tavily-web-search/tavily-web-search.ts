/**
 * Tavily Web Search Extension
 *
 * Provides web search, page extraction, and site crawling via Tavily API.
 * Requires TAVILY_API_KEY environment variable.
 *
 * Tools:
 *   - tavily_search: Search the web for current information
 *   - tavily_extract: Extract full content from one or more URLs
 *   - tavily_crawl: Crawl a website and collect page content
 *   - tavily_map: Discover/mapped URLs from a website (sitemap generation)
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ── Tavily API helpers ──────────────────────────────────────────────────────

const BASE_URL = (process.env.TAVILY_BASE_URL || "https://api.tavily.com").replace(/\/+$/, "");

/**
 * Resolve the Tavily API key from multiple sources (in priority order):
 *   1. TAVILY_API_KEY environment variable
 *   2. ~/.pi/.env file
 *   3. Project-level .env file (CWD)
 */
function resolveApiKey(): string | undefined {
  // 1. Environment variable
  if (process.env.TAVILY_API_KEY) {
    return process.env.TAVILY_API_KEY;
  }

  // 2. ~/.pi/.env file
  const homeEnv = join(process.env.HOME || "", ".pi", ".env");
  if (existsSync(homeEnv)) {
    try {
      const key = readFileSync(homeEnv, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("TAVILY_API_KEY="));
      if (key) {
        return key.slice("TAVILY_API_KEY=".length).replace(/^"|"$/g, "");
      }
    } catch {
      // ignore
    }
  }

  // 3. Project-level .env file
  const projectEnv = join(process.cwd(), ".env");
  if (existsSync(projectEnv)) {
    try {
      const key = readFileSync(projectEnv, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("TAVILY_API_KEY="));
      if (key) {
        return key.slice("TAVILY_API_KEY=".length).replace(/^"|"$/g, "");
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

const API_KEY = resolveApiKey();

function requireApiKey(): void {
  if (!API_KEY) {
    throw new Error(
      "TAVILY_API_KEY is not set.\n" +
        "1. Get an API key from https://tavily.com/\n" +
        "2. Set it via one of:\n" +
        "   - Environment: export TAVILY_API_KEY='your-key-here'\n" +
        "   - ~/.pi/.env file (add: TAVILY_API_KEY='your-key-here')\n" +
        "   - Project .env file (add: TAVILY_API_KEY='your-key-here')",
    );
  }
}

function parseFlags(args: string[]): { flags: Record<string, string | boolean>; positionals: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
      continue;
    }
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { flags, positionals };
}

function asInt(value: string | boolean | undefined, fallback: number): number {
  if (value === undefined || value === true) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function tavilyPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  requireApiKey();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object"
        ? JSON.stringify(payload, null, 2)
        : String(text || response.statusText);
    throw new Error(`Tavily request failed (${response.status}): ${message}`);
  }

  return payload;
}

// ── tavily_map implementation ───────────────────────────────────────────────

interface MapParams {
  baseUrl: string;
  instructions?: string;
  maxDepth: number;
  maxBreadth: number;
  limit: number;
  selectPaths?: string[];
  selectDomains?: string[];
  excludePaths?: string[];
  excludeDomains?: string[];
  allowExternal: boolean;
  timeout: number;
  includeUsage: boolean;
}

async function executeMap(
  _toolCallId: string,
  params: MapParams,
  _signal: AbortSignal | undefined,
  _onUpdate: ((update: { content: Array<{ type: string; text: string }> }) => void) | undefined,
  _ctx: ExtensionContext,
): Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }> {
  const payload: Record<string, unknown> = {
    url: params.baseUrl,
    max_depth: params.maxDepth,
    max_breadth: params.maxBreadth,
    limit: params.limit,
    allow_external: params.allowExternal,
    timeout: params.timeout,
  };
  if (params.instructions) payload.instructions = params.instructions;
  if (params.selectPaths) payload.select_paths = params.selectPaths;
  if (params.selectDomains) payload.select_domains = params.selectDomains;
  if (params.excludePaths) payload.exclude_paths = params.excludePaths;
  if (params.excludeDomains) payload.exclude_domains = params.excludeDomains;
  if (params.includeUsage) payload.include_usage = params.includeUsage;

  const result = (await tavilyPost("/map", payload)) as Record<string, unknown>;

  const urls = (result.results as string[]) ?? [];

  return {
    content: [
      {
        type: "text",
        text: `Mapped ${urls.length} URL(s) from ${params.baseUrl}:\n\n${urls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`,
      },
    ],
    details: {
      baseUrl: params.baseUrl,
      urlsMapped: urls.length,
      responseTime: (result.response_time as number) ?? undefined,
      creditsUsed: (result.usage as Record<string, unknown>)?.credits,
    },
  };
}

// ── Tool implementations ────────────────────────────────────────────────────

async function executeSearch(
  _toolCallId: string,
  params: SearchParams,
  _signal: AbortSignal | undefined,
  _onUpdate: ((update: { content: Array<{ type: string; text: string }> }) => void) | undefined,
  _ctx: ExtensionContext,
): Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }> {
  const result = (await tavilyPost("/search", {
    query: params.query,
    max_results: params.maxResults,
    search_depth: params.searchDepth,
    include_answer: params.includeAnswer,
    include_raw_content: params.includeRawContent,
  })) as Record<string, unknown>;

  // Format the result for readability
  const results = (result.results as Array<Record<string, unknown>>) ?? [];
  const formattedResults = results.map((r: Record<string, unknown>, i: number) => {
    const title = r.title || "Untitled";
    const url = r.url || "";
    const snippet = r.content || "";
    return `### ${i + 1}. ${title}
URL: ${url}
${snippet ? `Snippet: ${snippet}` : ""}`;
  });

  const answer = (result.answer as string) ? `\n\n**AI Answer:** ${(result.answer as string).slice(0, 2000)}` : "";

  return {
    content: [
      {
        type: "text",
        text: `${formattedResults.join("\n\n")}${answer}\n\nFound ${results.length} result(s).`,
      },
    ],
    details: {
      query: params.query,
      resultsFound: results.length,
    },
  };
}

async function executeExtract(
  _toolCallId: string,
  params: ExtractParams,
  _signal: AbortSignal | undefined,
  _onUpdate: ((update: { content: Array<{ type: string; text: string }> }) => void) | undefined,
  _ctx: ExtensionContext,
): Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }> {
  const result = (await tavilyPost("/extract", {
    urls: params.urls,
    extract_depth: params.extractDepth,
    format: params.format,
    include_images: params.includeImages,
    include_favicon: params.includeFavicon,
  })) as Record<string, unknown>;

  const results = (result.results as Array<Record<string, unknown>>) ?? [];
  const formattedResults = results.map((r: Record<string, unknown>) => {
    const url = r.url || "unknown";
    const rawContent = r.raw_content || "";
    const markdown = r.markdown || "";
    const content = markdown || rawContent || "(no content extracted)";
    return `---\nURL: ${url}\n${content}\n---`;
  });

  return {
    content: [
      {
        type: "text",
        text: formattedResults.join("\n\n"),
      },
    ],
    details: {
      urlsExtracted: results.length,
    },
  };
}

async function executeCrawl(
  _toolCallId: string,
  params: CrawlParams,
  _signal: AbortSignal | undefined,
  onUpdate: ((update: { content: Array<{ type: string; text: string }> }) => void) | undefined,
  _ctx: ExtensionContext,
): Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }> {
  // Notify that crawling has started
  onUpdate?.({
    content: [{ type: "text", text: `Starting crawl of ${params.baseUrl}...` }],
  });

  const payload: Record<string, unknown> = {
    url: params.baseUrl,
    max_depth: params.maxDepth,
    max_breadth: params.maxBreadth,
    limit: params.limit,
  };
  if (params.instructions) {
    payload.instructions = params.instructions;
  }

  const result = (await tavilyPost("/crawl", payload)) as Record<string, unknown>;

  // Handle async response (crawl may take time)
  const taskId = result.task_id as string | undefined;
  if (taskId) {
    onUpdate?.({
      content: [{ type: "text", text: `Crawl started (task: ${taskId}). Polling for results...` }],
    });

    // Poll for results
    const maxAttempts = 60;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const status = (await tavilyPost(`/crawl/status/${taskId}`, {})) as Record<string, unknown>;
      const statusStr = status.status as string;

      if (statusStr === "complete") {
        const results = (status.results as Array<Record<string, unknown>>) ?? [];
        const formattedResults = results.map((r: Record<string, unknown>) => {
          const url = r.url || "unknown";
          const rawContent = r.raw_content || "";
          const markdown = r.markdown || "";
          const content = markdown || rawContent || "(no content)";
          return `---\nURL: ${url}\n${content}\n---`;
        });

        return {
          content: [
            {
              type: "text",
              text: formattedResults.join("\n\n"),
            },
          ],
          details: {
            urlsCrawled: results.length,
            taskId,
          },
        };
      }

      if (statusStr === "failed") {
        throw new Error(`Crawl failed: ${JSON.stringify(status)}`);
      }

      // Still running...
      onUpdate?.({
        content: [{ type: "text", text: `Crawl in progress... (${attempt + 1}/${maxAttempts})` }],
      });
    }

    throw new Error("Crawl timed out after polling for results.");
  }

  // Sync response (fallback)
  const results = (result.results as Array<Record<string, unknown>>) ?? [];
  const formattedResults = results.map((r: Record<string, unknown>) => {
    const url = r.url || "unknown";
    const rawContent = r.raw_content || "";
    const markdown = r.markdown || "";
    const content = markdown || rawContent || "(no content)";
    return `---\nURL: ${url}\n${content}\n---`;
  });

  return {
    content: [
      {
        type: "text",
        text: formattedResults.join("\n\n"),
      },
    ],
    details: {
      urlsCrawled: results.length,
    },
  };
}

// ── Parameter types ─────────────────────────────────────────────────────────

interface MapParams {
  baseUrl: string;
  instructions?: string;
  maxDepth: number;
  maxBreadth: number;
  limit: number;
  selectPaths?: string[];
  selectDomains?: string[];
  excludePaths?: string[];
  excludeDomains?: string[];
  allowExternal: boolean;
  timeout: number;
  includeUsage: boolean;
}

interface SearchParams {
  query: string;
  maxResults: number;
  searchDepth: "basic" | "advanced";
  includeAnswer: boolean;
  includeRawContent: boolean;
}

interface ExtractParams {
  urls: string[];
  extractDepth: "basic" | "advanced";
  format: "markdown" | "text";
  includeImages: boolean;
  includeFavicon: boolean;
}

interface CrawlParams {
  baseUrl: string;
  instructions?: string;
  maxDepth: number;
  maxBreadth: number;
  limit: number;
}

// ── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Register tavily_search tool
  pi.registerTool({
    name: "tavily_search",
    label: "Tavily Search",
    description:
      "Search the web for current information using Tavily. Use for finding relevant pages, news, sources, or recent updates. Returns ranked search results with snippets.",
    promptSnippet: "Search the web for current information via Tavily",
    promptGuidelines: [
      "Use tavily_search when the user asks for current facts, news, or recent information from the web.",
      "Use tavily_search when you need to find relevant sources or candidate URLs for further extraction.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "The search query. Be specific and include relevant keywords.",
      }),
      maxResults: Type.Optional(
        Type.Number({
          description: "Maximum number of results to return (default: 5).",
          minimum: 1,
          maximum: 20,
        }),
      ),
      searchDepth: Type.Optional(
        Type.Union([Type.Literal("basic"), Type.Literal("advanced")]),
        {
          description: "Search depth: 'basic' for quick results, 'advanced' for deeper analysis (default: 'basic').",
        },
      ),
      includeAnswer: Type.Optional(
        Type.Boolean({
          description: "Include a concise AI-generated answer alongside results (default: false).",
        }),
      ),
      includeRawContent: Type.Optional(
        Type.Boolean({
          description: "Include full page content in results (default: false, only snippets).",
        }),
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return executeSearch(
        toolCallId,
        {
          query: params.query,
          maxResults: params.maxResults ?? 5,
          searchDepth: (params.searchDepth as "basic" | "advanced") ?? "basic",
          includeAnswer: params.includeAnswer ?? false,
          includeRawContent: params.includeRawContent ?? false,
        },
        signal,
        onUpdate,
        ctx,
      );
    },
  });

  // Register tavily_extract tool
  pi.registerTool({
    name: "tavily_extract",
    label: "Tavily Extract",
    description:
      "Extract full content from one or more web pages. Use when you need to read the complete content of specific URLs, such as articles, documentation, or blog posts. Returns clean text or markdown.",
    promptSnippet: "Extract page content from URLs via Tavily",
    promptGuidelines: [
      "Use tavily_extract when the user provides URLs and wants the full page content.",
      "Use tavily_extract after tavily_search to read the most relevant search result in full.",
      "Use tavily_extract when you need to analyze article content, documentation, or any web page.",
    ],
    parameters: Type.Object({
      urls: Type.Array(
        Type.String({
          description: "URL(s) to extract content from. Can be a single URL or multiple URLs as an array.",
        }),
        {
          description: "One or more URLs to extract.",
          minItems: 1,
        },
      ),
      extractDepth: Type.Optional(
        Type.Union([Type.Literal("basic"), Type.Literal("advanced")]),
        {
          description: "Extraction depth: 'basic' for quick extraction, 'advanced' for tables and embedded content (default: 'basic').",
        },
      ),
      format: Type.Optional(
        Type.Union([Type.Literal("markdown"), Type.Literal("text")]),
        {
          description: "Output format: 'markdown' for formatted text, 'text' for plain text (default: 'markdown').",
        },
      ),
      includeImages: Type.Optional(
        Type.Boolean({
          description: "Include image URLs in the output (default: false).",
        }),
      ),
      includeFavicon: Type.Optional(
        Type.Boolean({
          description: "Include favicon URL in the output (default: false).",
        }),
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return executeExtract(
        toolCallId,
        {
          urls: Array.isArray(params.urls) ? params.urls : [params.urls],
          extractDepth: (params.extractDepth as "basic" | "advanced") ?? "basic",
          format: (params.format as "markdown" | "text") ?? "markdown",
          includeImages: params.includeImages ?? false,
          includeFavicon: params.includeFavicon ?? false,
        },
        signal,
        onUpdate,
        ctx,
      );
    },
  });

  // Register tavily_crawl tool
  pi.registerTool({
    name: "tavily_crawl",
    label: "Tavily Crawl",
    description:
      "Crawl a website and collect content from multiple pages. Use when you need broad coverage of a documentation site, blog, or small website. Crawls from a base URL following links.",
    promptSnippet: "Crawl a website and collect page content via Tavily",
    promptGuidelines: [
      "Use tavily_crawl when the user wants to explore a documentation site or collect content from multiple pages of a website.",
      "Use tavily_crawl for site-wide research or when you need to understand the structure of a documentation area.",
    ],
    parameters: Type.Object({
      baseUrl: Type.String({
        description: "The base URL to start crawling from (e.g., 'https://docs.example.com').",
      }),
      instructions: Type.Optional(
        Type.String({
          description: "Custom instructions for the crawler. Specify what kind of content to look for or any filtering rules.",
        }),
      ),
      maxDepth: Type.Optional(
        Type.Number({
          description: "Maximum crawl depth from base URL (default: 2).",
          minimum: 1,
          maximum: 10,
        }),
      ),
      maxBreadth: Type.Optional(
        Type.Number({
          description: "Maximum number of pages to crawl per level (default: 20).",
          minimum: 1,
          maximum: 100,
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum total pages to crawl (default: 50).",
          minimum: 1,
          maximum: 500,
        }),
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return executeCrawl(
        toolCallId,
        {
          baseUrl: params.baseUrl,
          instructions: params.instructions,
          maxDepth: params.maxDepth ?? 2,
          maxBreadth: params.maxBreadth ?? 20,
          limit: params.limit ?? 50,
        },
        signal,
        onUpdate,
        ctx,
      );
    },
  });

  // Register tavily_map tool
  pi.registerTool({
    name: "tavily_map",
    label: "Tavily Map",
    description:
      "Discover and map URLs from a website. Generates a comprehensive sitemap by traversing the site like a graph. Returns a list of discovered URLs without fetching page content. Useful for understanding site structure before crawling or extracting.",
    promptSnippet: "Discover/mapped URLs from a website via Tavily",
    promptGuidelines: [
      "Use tavily_map when you need to discover all URLs on a website (sitemap generation).",
      "Use tavily_map before crawling or extracting to understand the full site structure.",
      "Use select_paths/exclude_paths to filter URLs by pattern (regex).",
    ],
    parameters: Type.Object({
      baseUrl: Type.String({
        description: "The root URL to begin mapping from (e.g., 'https://docs.example.com').",
      }),
      instructions: Type.Optional(
        Type.String({
          description: "Natural language instructions for the crawler. When specified, the cost increases to 2 API credits per 10 successful pages instead of 1 credit per 10 pages.",
        }),
      ),
      maxDepth: Type.Optional(
        Type.Number({
          description: "Max depth from base URL (default: 1). Range: 1-5.",
          minimum: 1,
          maximum: 5,
        }),
      ),
      maxBreadth: Type.Optional(
        Type.Number({
          description: "Max links to follow per page (default: 20). Range: 1-500.",
          minimum: 1,
          maximum: 500,
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Total URLs to discover before stopping (default: 50).",
          minimum: 1,
        }),
      ),
      selectPaths: Type.Optional(
        Type.Array(
          Type.String({
            description: "Regex patterns to select only URLs with matching paths (e.g., ['/docs/.*', '/api/v1.*']).",
          }),
        ),
      ),
      selectDomains: Type.Optional(
        Type.Array(
          Type.String({
            description: "Regex patterns to restrict crawling to specific domains (e.g., ['^docs\\.example\\.com$']).",
          }),
        ),
      ),
      excludePaths: Type.Optional(
        Type.Array(
          Type.String({
            description: "Regex patterns to exclude URLs with matching paths (e.g., ['/admin/.*', '/private/.*']).",
          }),
        ),
      ),
      excludeDomains: Type.Optional(
        Type.Array(
          Type.String({
            description: "Regex patterns to exclude specific domains (e.g., ['^cdn\\.example\\.com$']).",
          }),
        ),
      ),
      allowExternal: Type.Optional(
        Type.Boolean({
          description: "Whether to include external domain links in results (default: true).",
        }),
      ),
      timeout: Type.Optional(
        Type.Number({
          description: "Max seconds to wait for the map operation (default: 150). Range: 10-150.",
          minimum: 10,
          maximum: 150,
        }),
      ),
      includeUsage: Type.Optional(
        Type.Boolean({
          description: "Whether to include credit usage information in the response (default: false).",
        }),
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return executeMap(
        toolCallId,
        {
          baseUrl: params.baseUrl,
          instructions: params.instructions,
          maxDepth: params.maxDepth ?? 1,
          maxBreadth: params.maxBreadth ?? 20,
          limit: params.limit ?? 50,
          selectPaths: params.selectPaths,
          selectDomains: params.selectDomains,
          excludePaths: params.excludePaths,
          excludeDomains: params.excludeDomains,
          allowExternal: params.allowExternal ?? true,
          timeout: params.timeout ?? 150,
          includeUsage: params.includeUsage ?? false,
        },
        signal,
        onUpdate,
        ctx,
      );
    },
  });

  // Session start: notify about Tavily availability
  pi.on("session_start", async (_event, ctx) => {
    if (API_KEY) {
      ctx.ui.setStatus("tavily", ctx.ui.theme.fg("success", "Tavily: ready"));
    } else {
      ctx.ui.setStatus(
        "tavily",
        ctx.ui.theme.fg("warning", "Tavily: API key not set (export TAVILY_API_KEY)"),
      );
    }
  });
}
