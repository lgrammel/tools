# @lgrammel/kiwix-tool

AI SDK 7 canary tool for reading local Kiwix/ZIM archives in Node.js with `@openzim/libzim`.

```ts
import { createKiwixTools } from "@lgrammel/kiwix-tool";
import { generateText } from "ai";

const result = await generateText({
  model,
  tools: createKiwixTools({
    zimPath: "~/opt/zim/wikipedia.zim"
  }),
  prompt: "Use Wikipedia to answer: what is Kiwix?"
});
```

## Tool Actions

- `metadata`: archive metadata and counts
- `search`: full-text search
- `suggest`: title suggestions
- `readPath`: read an exact ZIM path
- `readTitle`: read an exact ZIM title
- `readMain`: read the archive main entry
- `readRandom`: read a random entry

HTML entries are converted to UTF-8 text before returning them to the model. Non-text entries are returned as base64.
