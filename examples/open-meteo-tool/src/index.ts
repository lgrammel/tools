import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { runAgentTUI } from "@lgrammel/agent-tui";
import { weatherForecast, weatherLocationSearch } from "@lgrammel/open-meteo-tool";
import { ToolLoopAgent, type Agent } from "ai";

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use weatherLocationSearch to resolve place names to coordinates, then use weatherForecast for current conditions and forecasts. Include the location, dates, and units in your answer.",
  tools: {
    weatherLocationSearch,
    weatherForecast,
  },
});

await runAgentTUI({
  name: "Open-Meteo Tool",
  agent: agent as Agent<any, any, any, any>,
  tools: "collapsed",
  reasoning: "hidden",
});
