# @lgrammel/kiwix-tool

AI SDK 7 tool package for searching and reading local [Kiwix](https://kiwix.org/) `.zim` archives from Node.js.

Use it when a local agent should answer from an offline knowledge base such as Wikipedia, Stack Exchange, project docs, or another ZIM archive.

## Installation

```bash
bun add @lgrammel/kiwix-tool
```

This package uses `@openzim/libzim` under the hood and must run in a Node.js-compatible environment.

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
      searchResultLimit: 5
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

- `kiwixSearch`: full-text search over the archive. Input is `{ query }`. Output is `results` with `title`, `path`, and optional `snippet`.
- `kiwixReadPage`: read a page by exact path returned from search. Input is `{ path }`. Output is `title`, `path`, `content`, and `truncated`.

The model cannot choose result or read limits. Search result count and page byte limits are configured only on the tool that uses them through each tool's `toolsContext` entry, validated by that tool's `contextSchema`, so tool outputs stay predictable for agents. HTML pages are converted to UTF-8 text before returning them to the model.

## API

Use the exported tools directly and pass tool-specific configuration through `toolsContext`:

```ts
import { kiwixReadPage, kiwixSearch } from "@lgrammel/kiwix-tool";

const kiwixArchiveContext = {
  zimPath: "~/opt/zim/wikipedia.zim"
};

const tools = {
  wikipediaSearch: kiwixSearch,
  wikipediaRead: kiwixReadPage
};

const toolsContext = {
  wikipediaSearch: {
    ...kiwixArchiveContext,
    searchResultLimit: 5
  },
  wikipediaRead: {
    ...kiwixArchiveContext,
    readMaxBytes: 80 * 1024
  }
};
```

Each tool keeps its archive connection private and refreshes it if the archive context changes.

## Shared Archive Context

- `zimPath`: path to the `.zim` file. `~/` is expanded to the current user's home directory.
- `preloadXapianDb`: preload the full-text index when opening the archive. Defaults to `true`.
- `preloadDirentRanges`: number of directory entry ranges to preload when opening the archive.

## Search Context

- `searchResultLimit`: fixed number of search results returned to the agent. Defaults to `5` and is capped at `10`.

## Read Context

- `readMaxBytes`: maximum page bytes read before conversion to text. Defaults to `81920` and is capped at `524288`.
