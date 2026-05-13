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
import { KiwixTools } from "@lgrammel/kiwix-tool";
import { ToolLoopAgent } from "ai";

const kiwix = new KiwixTools({
  zimPath: "~/opt/zim/wikipedia.zim"
});

const agent = new ToolLoopAgent({
  model,
  instructions: "Answer using the local Wikipedia archive. Search before reading pages.",
  tools: {
    wikipediaSearch: kiwix.searchTool,
    wikipediaRead: kiwix.readTool
  }
});

const result = await agent.generate({
  prompt: "What is Kiwix?"
});
```

## Tools

- `searchTool`: full-text search over the archive. Input is `{ query }`. Output is `results` with `title`, `path`, and optional `snippet`.
- `readTool`: read a page by exact path returned from search. Input is `{ path }`. Output is `title`, `path`, `content`, and `truncated`.

The model cannot choose result or read limits. Search result count and page byte limits are configured in `KiwixTools` constructor options so tool outputs stay predictable for agents. HTML pages are converted to UTF-8 text before returning them to the model.

## API

Create both tools from one shared reader:

```ts
const kiwix = new KiwixTools({
  zimPath: "~/opt/zim/wikipedia.zim",
  searchResultLimit: 5,
  readMaxBytes: 80 * 1024,
  preloadXapianDb: true
});
```

Create individual tools when you only need one:

```ts
import { createKiwixReadTool, createKiwixSearchTool } from "@lgrammel/kiwix-tool";

const searchTool = createKiwixSearchTool({ zimPath });
const readTool = createKiwixReadTool({ zimPath });
```

Use `KiwixReader` directly when you want to wrap the behavior yourself:

```ts
import { KiwixReader, kiwixReadTool, kiwixSearchTool } from "@lgrammel/kiwix-tool";

const reader = new KiwixReader({ zimPath });

const tools = {
  wikipediaSearch: kiwixSearchTool(reader),
  wikipediaRead: kiwixReadTool(reader)
};
```

## Options

- `zimPath`: path to the `.zim` file. `~/` is expanded to the current user's home directory.
- `searchResultLimit`: fixed number of search results returned to the agent. Defaults to `5` and is capped at `10`.
- `readMaxBytes`: maximum page bytes read before conversion to text. Defaults to `81920` and is capped at `524288`.
- `preloadXapianDb`: preload the full-text index when opening the archive.
- `preloadDirentRanges`: number of directory entry ranges to preload when opening the archive.
