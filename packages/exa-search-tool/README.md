# @lgrammel/exa-search-tool

AI SDK 7 tools for searching the web and fetching page content through [Exa](https://exa.ai/). The package calls Exa with `fetch` directly and requires an Exa API key.

## Install

```bash
bun add @lgrammel/exa-search-tool ai
```

## Usage

```ts
import { openai } from "@ai-sdk/openai";
import { webFetch, webSearch } from "@lgrammel/exa-search-tool";
import { ToolLoopAgent } from "ai";

const exaApiKey = process.env.EXA_API_KEY;

if (!exaApiKey) {
  throw new Error("EXA_API_KEY must be set.");
}

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use web search when current or external information is needed. Fetch pages before relying on their details, and cite the URLs you used.",
  tools: {
    webSearch,
    webFetch,
  },
  toolsContext: {
    webSearch: {
      apiKey: exaApiKey,
      searchResultLimit: 5,
    },
    webFetch: {
      apiKey: exaApiKey,
      fetchMaxCharacters: 80 * 1024,
    },
  },
});

const result = await agent.generate({
  prompt: "What did Anthropic announce most recently?",
});

console.log(result.text);
```

## Tools

- `webSearch`: searches the web with Exa. Input is `{ query }`. Output is `results` with `title`, `url`, optional `id`, `publishedDate`, `author`, `highlights`, `image`, and `favicon`.
- `webFetch`: fetches clean page text for a URL. Input is `{ url }`. Output is `title`, `url`, optional metadata, `content`, and `truncated`.

Configuration lives in `toolsContext` and is validated by each tool's `contextSchema`, so the model cannot choose API keys, result counts, domains, freshness, or content size.

## Context

- `apiKey`: Exa API key used as the `x-api-key` request header.
- `baseUrl`: Exa API base URL. Defaults to `https://api.exa.ai`.
- `maxAgeHours`: maximum accepted age of cached Exa content in hours. Use `0` to always live crawl and `-1` to always use cache.
- `searchResultLimit`: fixed number of search results returned to the agent. Defaults to `5` and is capped at `10`.
- `searchType`: Exa search type. Defaults to `auto`.
- `highlightMaxCharacters`: maximum highlight characters per result. Defaults to `1000` and is capped at `4000`.
- `includeDomains`: domains to restrict search results to.
- `excludeDomains`: domains to exclude from search results.
- `fetchMaxCharacters`: maximum page text characters returned. Defaults to `81920` and is capped at `524288`.
- `textVerbosity`: Exa text verbosity. Defaults to `compact`.
- `includeHtmlTags`: include HTML tags in returned page text. Defaults to `false`.
- `includeSections`: semantic page sections to include when Exa live crawls the page.
- `excludeSections`: semantic page sections to exclude when Exa live crawls the page.
