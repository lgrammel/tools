import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { runAgentTUI } from "@ai-sdk/tui";
import { jsCodeExecutorTool } from "@lgrammel/js-code-executor-tool";
import { ToolLoopAgent, type Agent } from "ai";

const agent = new ToolLoopAgent({
  model: openai("gpt-5.5"),
  instructions:
    "Use the JavaScript executor for calculations, small data transformations, and quick checks. Return concise answers and mention when a result came from executed code.",
  tools: {
    executeJavaScript: jsCodeExecutorTool({
      context: {
        exampleName: "js-code-executor-tool",
      },
      timeoutMs: 5_000,
      maxOutputBytes: 64 * 1024,
    }),
  },
});

await runAgentTUI({
  title: "JavaScript Code Executor Tool",
  agent: agent as Agent<any, any, any, any>,
  tools: "collapsed",
  reasoning: "hidden",
});
