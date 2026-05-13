# JavaScript Code Executor Tool

AI SDK 7 tool for executing JavaScript code in the current runtime.

Use this tool only with trusted agents and prompts. It evaluates code in the current process, so synchronous infinite loops can block the event loop and the code can access globals available to the host runtime.

## Installation

```bash
bun add @lgrammel/js-code-executor-tool ai zod
```

## Usage

```ts
import { ToolLoopAgent } from "ai";
import { jsCodeExecutorTool } from "@lgrammel/js-code-executor-tool";

const agent = new ToolLoopAgent({
  model,
  instructions:
    "Use the JavaScript executor for small calculations and data transformations. Return values directly or print with console.log.",
  tools: {
    executeJavaScript: jsCodeExecutorTool({
      context: {
        userId: "user_123",
      },
      timeoutMs: 5_000,
      maxOutputBytes: 64 * 1024,
    }),
  },
});
```

The model supplies only the JavaScript source code. Code runs as an async function body, so it can use `await`, return a value, use the captured `console`, and read values from the `context` object.

## Options

- `context`: values exposed to executed code as the `context` object. Defaults to `{}`.
- `timeoutMs`: maximum time to wait for async code to settle. Defaults to `5000` and is capped at `60000`. This cannot interrupt synchronous code that is already running.
- `maxOutputBytes`: maximum combined stdout and stderr retained. Defaults to `65536` and is capped at `1048576`. Console calls that exceed this limit throw.

## Output

The tool returns:

- `result`: formatted returned value, when the code returns something other than `undefined`.
- `stdout`: captured `console.log`, `console.info`, `console.debug`, and related output.
- `stderr`: captured `console.error`, `console.warn`, and trace output.
- `error`: structured execution error, when the code throws or times out.
- `timedOut`: whether async execution exceeded `timeoutMs`.
- `outputTruncated`: whether output exceeded `maxOutputBytes`.
- `durationMs`: execution duration in milliseconds.
