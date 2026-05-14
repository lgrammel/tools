# @lgrammel/kiwix-tool

AI SDK 7 tools for searching and reading local [Kiwix](https://kiwix.org/) `.zim` archives from Node.js. Use them when an agent should answer from an offline knowledge base such as Wikipedia, Stack Exchange, or project docs.

## Install

```bash
bun add @lgrammel/kiwix-tool ai
```

This package uses `@openzim/libzim` and must run in a Node.js-compatible environment.

## Usage

```ts
import { kiwixReadPage, kiwixSearch } from "@lgrammel/kiwix-tool";
import { openai } from "@ai-sdk/openai";
import { ToolLoopAgent } from "ai";

const prompt =
  process.argv.slice(2).join(" ") || "Explain what Kiwix is in three concise bullet points.";

const kiwixArchiveContext = {
  zimPath: process.env.WIKIPEDIA_ZIM_PATH ?? "~/opt/zim/wikipedia.zim"
};

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Answer using the local Wikipedia archive. Search before reading pages, and cite the page titles you used.",
  tools: {
    wikipediaSearch: kiwixSearch,
    wikipediaRead: kiwixReadPage
  },
  toolsContext: {
    wikipediaSearch: {
      ...kiwixArchiveContext,
      searchResultLimit: 5,
      searchCandidateLimit: 100
    },
    wikipediaRead: {
      ...kiwixArchiveContext,
      readMaxBytes: 80 * 1024
    }
  }
});

const result = await agent.generate({
  prompt
});

console.log(result.text);
```

## Tools

- `kiwixSearch`: full-text search over the archive. It fetches a configurable number of raw libzim results, reranks them to prefer exact and prefix title/path matches, then returns the configured number of results. Input is `{ query }`. Output is `results` with `title`, `path`, and optional `snippet`.
- `kiwixReadPage`: read a page by exact path returned from search. Input is `{ path }`. Output is `title`, `path`, `content`, and `truncated`.

Configuration lives in `toolsContext` and is validated by each tool's `contextSchema`, so the model cannot choose archive paths or result/read limits. HTML pages are converted to UTF-8 text before returning them to the model.

## Context

- `zimPath`: path to the `.zim` file. `~/` is expanded to the current user's home directory.
- `preloadXapianDb`: preload the full-text index when opening the archive. Defaults to `true`.
- `preloadDirentRanges`: number of directory entry ranges to preload when opening the archive.
- `searchResultLimit`: fixed number of search results returned to the agent. Defaults to `5` and is capped at `10`.
- `searchCandidateLimit`: number of raw libzim results fetched before title-aware reranking. Defaults to `100` and is capped at `500`. The effective candidate limit is never lower than `searchResultLimit`.
- `readMaxBytes`: maximum page bytes read before conversion to text. Defaults to `81920` and is capped at `524288`.
