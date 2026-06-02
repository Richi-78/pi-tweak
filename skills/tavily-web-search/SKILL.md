---
name: tavily-web-search
description: "Search the web, extract page content, crawl sites, and discover URLs using Tavily API. Use when you need current facts, news, or source-backed information from the web."
---

# Tavily Web Search

Use this skill when the user needs fresh, source-backed web information that may have changed recently.

Prefer Tavily over general browsing when you want:

- a focused web search with ranked results
- the content of a specific page in clean text or markdown
- a crawl of a site or documentation area
- a map of all URLs on a website (sitemap discovery)

## Available Tools

This skill is provided via the **Tavily Web Search** pi extension. The following tools are available:

### `tavily_search`

Search the web for current information.

```typescript
// Basic search
tavily_search({ query: "latest TypeScript features 2026" })

// With options
tavily_search({
  query: "React Server Components best practices",
  maxResults: 10,
  searchDepth: "advanced",
  includeAnswer: true,
})
```

### `tavily_extract`

Extract full content from one or more URLs.

```typescript
// Single URL
tavily_extract({ urls: ["https://example.com/article"] })

// Multiple URLs
tavily_extract({
  urls: [
    "https://docs.example.com/api",
    "https://docs.example.com/guides",
  ],
  format: "markdown",
  extractDepth: "advanced",
})
```

### `tavily_map`

Discover and map all URLs from a website. Returns a list of discovered URLs without fetching page content. Useful for understanding site structure before crawling or extracting.

```typescript
// Basic map
tavily_map({ baseUrl: "https://docs.example.com" })

// With filters
tavily_map({
  baseUrl: "https://docs.example.com",
  maxDepth: 2,
  selectPaths: ["/api/.*", "/guides/.*"],
  excludePaths: ["/changelog/.*"],
  limit: 100,
})

// With natural language instructions
tavily_map({
  baseUrl: "https://blog.example.com",
  instructions: "Find all pages about web development",
  maxDepth: 3,
  limit: 50,
})
```

### `tavily_crawl`

Crawl a website and collect content from multiple pages.

```typescript
// Crawl a docs site
tavily_crawl({
  baseUrl: "https://docs.example.com",
  maxDepth: 2,
  maxBreadth: 20,
  limit: 50,
})

// With custom instructions
tavily_crawl({
  baseUrl: "https://blog.example.com",
  instructions: "Focus on technical posts about web development",
  limit: 20,
})
```

## Environment

The extension resolves `TAVILY_API_KEY` in this priority order:

1. **Environment variable** — `export TAVILY_API_KEY='your-key-here'`
2. **~/.pi/.env file** — add `TAVILY_API_KEY='your-key-here'`
3. **Project `.env` file** — add `TAVILY_API_KEY='your-key-here'` to the project root

Optional: `TAVILY_BASE_URL` to override the API host (resolved from env var only).

## Basic Workflow

1. **Search** first when you need current facts or candidate sources.
2. **Extract** the most relevant URL(s) when the source page needs to be read closely.
3. **Map** when you need to discover all URLs on a website before crawling or extracting.
4. **Crawl** when you need full content coverage across a docs site or a set of related pages.

## Suggested Defaults

- Use `searchDepth: "basic"` unless you need deeper result snippets.
- Keep `maxResults` small (3-5) for quick lookups.
- Use `includeAnswer: true` when a short AI summary is helpful.
- Use `extractDepth: "basic"` first, then `"advanced"` if you need tables or embedded content.
- Use `maxDepth: 1` for tavily_map unless you need deeper traversal.
- Use `selectPaths`/`excludePaths` to filter URLs by regex pattern.
- Keep `tavily_map` limit small (20-50) for quick structure discovery.

## Tavily Endpoints

- Search: `POST /search`
- Extract: `POST /extract`
- Crawl: `POST /crawl`
- Map: `POST /map`

Official docs:

- Search: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Extract: https://docs.tavily.com/documentation/api-reference/endpoint/extract
- Crawl: https://docs.tavily.com/documentation/api-reference/endpoint/crawl
- Map: https://docs.tavily.com/documentation/api-reference/endpoint/map
