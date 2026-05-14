import { expectTypeOf } from "vitest";
import { ToolLoopAgent } from "ai";
import { weather } from "./index.js";

// @ts-expect-error weather requires a toolsContext entry.
new ToolLoopAgent({
  model: "openai/gpt-5.5",
  tools: {
    weather,
  },
});

new ToolLoopAgent({
  model: "openai/gpt-5.5",
  tools: {
    weather,
  },
  toolsContext: {
    // @ts-expect-error weather requires units.
    weather: {
      language: "en",
    },
  },
});

expectTypeOf(
  new ToolLoopAgent({
    model: "openai/gpt-5.5",
    tools: {
      weather,
    },
    toolsContext: {
      weather: {
        units: "metric",
        language: "en",
        forecastDays: 7,
        hourlyForecastHours: 24,
        timezone: "auto",
      },
    },
  }),
).toBeObject();
