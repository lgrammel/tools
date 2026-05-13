import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { runAgentTUI } from "@lgrammel/agent-tui";
import { KiwixTools } from "@lgrammel/kiwix-tool";
import { ToolLoopAgent, type Agent } from "ai";

const wikipediaZimPath = process.env.WIKIPEDIA_ZIM_PATH;

if (!wikipediaZimPath) {
  throw new Error("WIKIPEDIA_ZIM_PATH must be set in examples/kiwix-tool/.env");
}

const wikipediaKiwix = new KiwixTools({
  zimPath: wikipediaZimPath,
  preloadXapianDb: true,
});

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Ground your answers in the local Wikipedia archive. Search before reading pages, and cite the page titles you used.",
  tools: {
    wikipediaSearch: wikipediaKiwix.searchTool,
    wikipediaRead: wikipediaKiwix.readTool,
  },
});

await runAgentTUI({
  name: "Kiwix Tool",
  agent: agent as Agent<any, any, any, any>,
  tools: "collapsed",
  reasoning: "hidden",
});
