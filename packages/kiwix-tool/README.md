# @lgrammel/kiwix-tool

AI SDK 7 canary tool for reading local Kiwix/ZIM archives in Node.js with `@openzim/libzim`.

```ts
import { createKiwixReadTool, createKiwixSearchTool } from "@lgrammel/kiwix-tool";
import { ToolLoopAgent } from "ai";

const kiwixToolOptions = {
  zimPath: "~/opt/zim/wikipedia.zim"
};

const agent = new ToolLoopAgent({
  model,
  instructions: "Answer using the local Wikipedia archive. Search before reading pages.",
  tools: {
    wikipediaSearch: createKiwixSearchTool(kiwixToolOptions),
    wikipediaRead: createKiwixReadTool(kiwixToolOptions)
  }
});

const result = await agent.generate({
  prompt: "What is Kiwix?"
});
```

## Tools

- `kiwixSearchTool`: full-text search. Input is only `{ query }`. Output is `results` with `title`, `path`, and optional `snippet`.
- `kiwixReadTool`: read a page by exact path. Input is only `{ path }`. Output is `title`, `path`, `content`, and `truncated`.

The model cannot choose limits. Search result count and page byte limits are fixed in tool creation options so tool outputs stay small enough for agents. HTML pages are converted to UTF-8 text before returning them to the model.
