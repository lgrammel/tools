import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { KiwixTools } from "@lgrammel/kiwix-tool";
import { ToolLoopAgent } from "ai";

const wikipediaZimPath = process.env.WIKIPEDIA_ZIM_PATH;

if (!wikipediaZimPath) {
  throw new Error("WIKIPEDIA_ZIM_PATH must be set in examples/terminal/.env");
}

const prompt =
  process.argv.slice(2).join(" ") || "Explain what Kiwix is in three concise bullet points.";

const wikipediaKiwix = new KiwixTools({
  zimPath: wikipediaZimPath,
  preloadXapianDb: true,
});

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions: "Ground your answers in the local Wikipedia archive.",
  tools: {
    wikipediaSearch: wikipediaKiwix.searchTool,
    wikipediaRead: wikipediaKiwix.readTool,
  },
});

const result = await agent.generate({
  prompt,
});

console.log(JSON.stringify(result.steps, null, 2));

console.log(result.text);
