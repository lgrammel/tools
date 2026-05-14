import { expectTypeOf } from "vitest";
import { ToolLoopAgent } from "ai";
import { currentDate } from "./index.js";

// @ts-expect-error currentDate requires a toolsContext entry.
new ToolLoopAgent({
  model: "openai/gpt-5.5",
  tools: {
    currentDate,
  },
});

new ToolLoopAgent({
  model: "openai/gpt-5.5",
  tools: {
    currentDate,
  },
  toolsContext: {
    // @ts-expect-error currentDate requires timezone.
    currentDate: {},
  },
});

expectTypeOf(
  new ToolLoopAgent({
    model: "openai/gpt-5.5",
    tools: {
      currentDate,
    },
    toolsContext: {
      currentDate: {
        timezone: "Europe/Berlin",
      },
    },
  }),
).toBeObject();
