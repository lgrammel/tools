import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { KiwixTools } from "@lgrammel/kiwix-tool";
import { ToolLoopAgent } from "ai";

const zimPath = process.env.KIWIX_ZIM_PATH;

if (!zimPath) {
  throw new Error("KIWIX_ZIM_PATH must be set in examples/terminal/.env");
}

const prompt =
  process.argv.slice(2).join(" ") || "Explain what Kiwix is in three concise bullet points.";

console.error(`Using ZIM archive: ${zimPath}`);

const kiwix = new KiwixTools({
  zimPath,
  preloadXapianDb: true,
});

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Answer using the local Kiwix Wikipedia archive." +
    "Search with wikipediaSearch first, then use wikipediaRead with a path from the search results before answering.",
  tools: {
    wikipediaSearch: kiwix.searchTool,
    wikipediaRead: kiwix.readTool,
  },
});

const result = await agent.generate({
  prompt,
});

console.log(result.text);
