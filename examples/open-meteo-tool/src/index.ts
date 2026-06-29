import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { runAgentTUI } from "@ai-sdk/tui";
import { weather } from "@lgrammel/open-meteo-tool";
import { ToolLoopAgent, type Agent } from "ai";

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use the weather tool for current conditions and forecasts. Include the resolved location, dates, and units in your answer.",
  tools: {
    weather,
  },
});

await runAgentTUI({
  title: "Open-Meteo Tool",
  agent: agent as Agent<any, any, any, any>,
  tools: "collapsed",
  reasoning: "hidden",
});
