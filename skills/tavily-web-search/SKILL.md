---
name: tavily-web-search
description: "Search the web, extract page content, and crawl sites using Tavily API. Use when you need current facts, news, or source-backed information from the web."
---

# Tavily Web Search

Use this skill when the user needs fresh, source-backed web information that may have changed recently.

Prefer Tavily over general browsing when you want:

- a focused web search with ranked results
- the content of a specific page in clean text or markdown
- a crawl of a site or documentation area

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
3. **Crawl** when you need coverage across a docs site or a small set of related pages.

## Suggested Defaults

- Use `searchDepth: "basic"` unless you need deeper result snippets.
- Keep `maxResults` small (3-5) for quick lookups.
- Use `includeAnswer: true` when a short AI summary is helpful.
- Use `extractDepth: "basic"` first, then `"advanced"` if you need tables or embedded content.

## Tavily Endpoints

- Search: `POST /search`
- Extract: `POST /extract`
- Crawl: `POST /crawl`

Official docs:

- Search: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Extract: https://docs.tavily.com/documentation/api-reference/endpoint/extract
- Crawl: https://docs.tavily.com/documentation/api-reference/endpoint/crawl
