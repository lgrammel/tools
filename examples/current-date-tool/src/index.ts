import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { runAgentTUI } from "@ai-sdk/tui";
import { currentDate } from "@lgrammel/current-date-tool";
import { ToolLoopAgent, type Agent } from "ai";

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use the current date tool whenever you need today's date, the current time, or relative dates. Include the timezone when it matters.",
  tools: {
    currentDate,
  },
  toolsContext: {
    currentDate: {
      timezone: "Europe/Berlin",
    },
  },
});

await runAgentTUI({
  title: "Current Date Tool",
  agent: agent as Agent<any, any, any, any>,
  tools: "collapsed",
  reasoning: "hidden",
});
