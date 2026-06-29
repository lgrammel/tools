import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { runAgentTUI } from "@ai-sdk/tui";
import { webFetch, webSearch } from "@lgrammel/exa-search-tool";
import { ToolLoopAgent, type Agent } from "ai";

const exaApiKey = process.env.EXA_API_KEY;

if (!exaApiKey) {
  throw new Error("EXA_API_KEY must be set in examples/exa-search-tool/.env");
}

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use webSearch for current or external information, then use webFetch to read the most relevant pages before answering. Cite the URLs you used.",
  tools: {
    webSearch,
    webFetch,
  },
  toolsContext: {
    webSearch: {
      apiKey: exaApiKey,
      searchResultLimit: 5,
      searchType: "auto",
    },
    webFetch: {
      apiKey: exaApiKey,
      fetchMaxCharacters: 80 * 1024,
    },
  },
});

await runAgentTUI({
  title: "Exa Search Tool",
  agent: agent as Agent<any, any, any, any>,
  tools: "collapsed",
  reasoning: "hidden",
});
