import { expectTypeOf } from "vitest";
import { ToolLoopAgent } from "ai";
import { weather } from "./index.js";

expectTypeOf(
  new ToolLoopAgent({
    model: "openai/gpt-5.5",
    tools: {
      weather,
    },
  }),
).toBeObject();

expectTypeOf(
  new ToolLoopAgent({
    model: "openai/gpt-5.5",
    tools: {
      weather,
    },
  }),
).toBeObject();
