# JavaScript Code Executor Tool

AI SDK 7 tool for executing JavaScript code in a bounded local Node.js subprocess.

Use this tool only with trusted agents and prompts. It executes code on the local machine with the permissions of the current process, including filesystem and network access.

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
    "Use the JavaScript executor for small calculations and data transformations. Print results with console.log.",
  tools: {
    executeJavaScript: jsCodeExecutorTool({
      timeoutMs: 5_000,
      maxOutputBytes: 64 * 1024,
    }),
  },
});
```

The model supplies only the JavaScript source code. Runtime limits, working directory, environment variables, and Node.js arguments are controlled by the application.

## Options

- `cwd`: working directory for the subprocess. Defaults to the current process working directory.
- `env`: environment variables exposed to the subprocess. Defaults to an empty environment.
- `inheritEnv`: inherit the parent process environment before applying `env`. Defaults to `false`.
- `nodePath`: Node.js executable used for execution. Defaults to the current Node.js executable.
- `nodeArgs`: additional arguments passed to Node.js.
- `timeoutMs`: maximum runtime before terminating the subprocess. Defaults to `5000` and is capped at `60000`.
- `maxOutputBytes`: maximum combined stdout and stderr retained before terminating the subprocess. Defaults to `65536` and is capped at `1048576`.

## Output

The tool returns:

- `stdout`: captured standard output.
- `stderr`: captured standard error.
- `exitCode`: process exit code, or `null` if the process exited from a signal.
- `signal`: terminating signal, or `null`.
- `timedOut`: whether the timeout terminated the process.
- `outputTruncated`: whether output exceeded `maxOutputBytes`.
- `durationMs`: execution duration in milliseconds.
