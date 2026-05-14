import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { runAgentTUI } from "@lgrammel/agent-tui";
import { kiwixReadPage, kiwixSearch } from "@lgrammel/kiwix-tool";
import { ToolLoopAgent } from "ai";

const wikipediaZimPath = process.env.WIKIPEDIA_ZIM_PATH;

if (!wikipediaZimPath) {
  throw new Error("WIKIPEDIA_ZIM_PATH must be set in examples/kiwix-tool/.env");
}

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Ground your answers in the local Wikipedia archive. Search before reading pages, and cite the page titles you used.",
  tools: {
    wikipediaSearch: kiwixSearch,
    wikipediaRead: kiwixReadPage,
  },
  toolsContext: {
    wikipediaSearch: { zimPath: wikipediaZimPath },
    wikipediaRead: { zimPath: wikipediaZimPath },
  },
});

await runAgentTUI({
  name: "Kiwix Tool",
  agent,
});
