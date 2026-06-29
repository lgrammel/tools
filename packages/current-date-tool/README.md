# @lgrammel/current-date-tool

AI SDK 7 tool for returning the current date and time in a configured IANA timezone. Use it when an agent needs to answer questions about today, now, deadlines, or relative dates.

## Install

```bash
pnpm add @lgrammel/current-date-tool ai
```

## Usage

```ts
import { openai } from "@ai-sdk/openai";
import { currentDate } from "@lgrammel/current-date-tool";
import { ToolLoopAgent } from "ai";

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use the current date tool whenever you need today's date, the current time, or relative dates. Mention the timezone when it matters.",
  tools: {
    currentDate,
  },
  toolsContext: {
    currentDate: {
      timezone: "Europe/Berlin",
    },
  },
});

const result = await agent.generate({
  prompt: "What date is next Friday?",
});

console.log(result.text);
```

## Tools

- `currentDate`: returns the current instant as UTC ISO, the configured timezone, localized date, localized time, localized date-time, UTC offset, timezone abbreviation, and timestamp. Input is `{}`.

The timezone is configured through `toolsContext` and validated by the tool's `contextSchema`, so the model cannot silently switch timezones.

- `timezone`: IANA timezone used to format the current date and time, for example `Europe/Berlin`, `America/New_York`, or `UTC`.
