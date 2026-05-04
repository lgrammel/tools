import { openai } from "@ai-sdk/openai";
import { KiwixTools } from "@lgrammel/kiwix-tool";
import { isStepCount, ToolLoopAgent } from "ai";

const zimPath = "/Users/lgrammel/opt/zim/wikipedia_en_all_maxi_2026-02.zim";

const prompt =
  process.argv.slice(2).join(" ") ||
  "Use the local Kiwix Wikipedia archive to explain what Kiwix is in three concise bullet points.";

console.error(`Using ZIM archive: ${zimPath}`);

const kiwix = new KiwixTools({
  zimPath,
  preloadXapianDb: true
});

const agent = new ToolLoopAgent({
  id: "kiwix-terminal-agent",
  model: openai(process.env.OPENAI_MODEL ?? "gpt-5-mini"),
  instructions:
    "Answer using the local Kiwix Wikipedia archive. Use wikipediaSearch first, then use wikipediaRead with a path from the search results before answering.",
  tools: {
    wikipediaSearch: kiwix.searchTool,
    wikipediaRead: kiwix.readTool
  },
  stopWhen: isStepCount(8)
});

const result = await agent.generate({
  prompt
});

console.log(result.text);
